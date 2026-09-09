import { NextResponse } from 'next/server'
import { AUTH_ERRORS, AUTHENTICATED_HOME_PATH, SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME } from '@/constants/auth'
import { API_URL } from '@/constants/env'
import { captureError, captureInfo } from '@/utils/captureError'
import { decryptSession } from '@/utils/crypto'
import { clearSessionCookies, setSessionCookies } from '@/utils/sessionCookies'
import type { SessionType } from '@/types/auth'
import type { NextRequest } from 'next/server'

const AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/signup/email-validation',
  '/signup/confirmation',
  '/password-recovery',
  '/password-recovery/confirmation'
])
const AUTH_PATH_PREFIXES = [...AUTH_PATHS].map(p => `${p}/`)

const PUBLIC_PATHS = new Set([
  '/',
  '/sentry-example-page' // Delete
])

// eslint-disable-next-line sonarjs/regex-complexity -- flat extension allowlist; readability beats micro-optimizing the alternation count
const STATIC_RESOURCES_REGEX = /\.(png|jpg|jpeg|svg|webp|ico|gif|mp4|webm|mov|woff2?|ttf|otf|eot|json|txt|xml|pdf|zip|map)$/i

// Must match `tunnelRoute` in next.config.ts — Sentry envelopes must reach the rewrite, not the login redirect.
const SENTRY_TUNNEL_PATH = '/monitoring'

const REFRESH_THRESHOLD_SECONDS = 60

// Per-instance dedup: concurrent requests in one edge worker share a single refresh.
// Cross-instance dedup isn't needed (worst case O(instances) refreshes per rotation).
const refreshInFlight = new Map<string, Promise<SessionType | null>>()
const refreshCache = new Map<string, { result: SessionType | null, timestamp: number }>()
const REFRESH_CACHE_TTL_MS = 10_000

// Pruned on use rather than by timer: a setTimeout may never fire in a frozen serverless worker.
const pruneRefreshCache = () => {
  const now = Date.now()
  for (const [key, entry] of refreshCache) {
    if (now - entry.timestamp >= REFRESH_CACHE_TTL_MS) refreshCache.delete(key)
  }
}

// Resolves null when the backend rejects the refresh token; throws when the backend is unreachable or 5xx.
async function refreshAccessToken (session: SessionType): Promise<SessionType | null> {
  pruneRefreshCache()

  const cached = refreshCache.get(session.refresh)
  if (cached) return cached.result

  const inFlight = refreshInFlight.get(session.refresh)
  if (inFlight) return inFlight

  const promise = (async (): Promise<SessionType | null> => {
    const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
      cache: 'no-store'
    })

    if (res.status >= 500) throw new Error(`Refresh endpoint unavailable (${res.status})`)
    if (!res.ok) return null

    const data = await res.json()
    if (!data.access || !data.access_expiration) return null

    return {
      ...session,
      access: data.access,
      access_expiration: data.access_expiration
    }
  })()

  refreshInFlight.set(session.refresh, promise)
  try {
    const result = await promise
    refreshCache.set(session.refresh, { result, timestamp: Date.now() })
    return result
  } finally {
    refreshInFlight.delete(session.refresh)
  }
}

const isAuthPath = (pathname: string): boolean =>
  AUTH_PATHS.has(pathname) || AUTH_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))

// Static resources, API routes, Next.js chunks, and public paths skip auth entirely.
const shouldBypassProxy = (pathname: string): boolean =>
  STATIC_RESOURCES_REGEX.test(pathname) ||
  pathname.startsWith('/api') ||
  pathname.startsWith('/_next') ||
  pathname === SENTRY_TUNNEL_PATH ||
  PUBLIC_PATHS.has(pathname)

// Only same-site relative paths, never an auth page (would bounce forever) — anything else falls back to home.
const safeNextPath = (value: string | null): string | null => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return isAuthPath(value.split('?', 1)[0]) ? null : value
}

// Redirect to /login remembering where the user was going; optionally purging the session cookies on the way out.
function redirectToLogin (req: NextRequest, clearCookies = false): NextResponse {
  const loginUrl = new URL('/login', req.url)
  const { pathname, search } = req.nextUrl
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`)

  const response = NextResponse.redirect(loginUrl)
  if (clearCookies) clearSessionCookies(response.cookies)
  return response
}

// Result of the proactive-refresh phase: either keep going with an (optionally
// refreshed) session, or signal the caller to kill the session and redirect.
type ResolvedSessionType =
  | { kill: true }
  | { kill: false, session: SessionType, refreshed: boolean }

async function resolveActiveSession (session: SessionType): Promise<ResolvedSessionType> {
  try {
    const accessExp = new Date(session.access_expiration).getTime()
    const secondsLeft = (accessExp - Date.now()) / 1000

    if (secondsLeft < REFRESH_THRESHOLD_SECONDS) {
      const refreshed = await refreshAccessToken(session)
      if (!refreshed) {
        // Expected on normal expiry — info, not an error, so it doesn't eat the Sentry quota.
        captureInfo('proxy-refresh-token', AUTH_ERRORS['refresh-token'])
        return { kill: true }
      }
      return { kill: false, session: refreshed, refreshed: true }
    }
  } catch (error) {
    // Backend down or network error: keep the current (still valid) session instead of logging the user out.
    captureError('proxy-refresh-unavailable', error, 'warning')
  }

  return { kill: false, session, refreshed: false }
}

export async function proxy (req: NextRequest) {
  const { pathname } = req.nextUrl

  // ⛔ Skip static resources, API routes, Next.js chunks, and public paths
  if (shouldBypassProxy(pathname)) return NextResponse.next()

  const isAuthFlow = isAuthPath(pathname)

  const authCookie = req.cookies.get(SESSION_COOKIE_NAME)
  const listenerCookie = req.cookies.get(LISTENER_COOKIE_NAME)

  // 🔄 If only one of the two auth cookies exists, the pair is corrupt — purge both.
  // Boolean(a) !== Boolean(b) is XOR: true iff exactly one cookie is present.
  if (Boolean(authCookie) !== Boolean(listenerCookie)) return redirectToLogin(req, true)

  // 🔄 No session at all
  if (!authCookie) {
    if (!isAuthFlow) return redirectToLogin(req)
    return NextResponse.next()
  }

  // 🔓 Decrypt session
  let session: SessionType | null = null
  try {
    session = await decryptSession(authCookie.value)
  } catch (error) {
    // Rotated AUTH_SECRET or a tampered cookie — worth seeing, but the user just gets logged out.
    captureError('proxy-session-decrypt', error, 'warning')
  }

  if (!session) {
    if (isAuthFlow) {
      const response = NextResponse.next()
      clearSessionCookies(response.cookies)
      return response
    }
    return redirectToLogin(req, true)
  }

  // ♻️ Proactive refresh — keeps access token alive ahead of expiry
  const resolved = await resolveActiveSession(session)
  if (resolved.kill) return redirectToLogin(req, true)

  // ✅ Authenticated: auth-flow paths bounce to where the user was going (or home), protected routes proceed
  const nextPath = safeNextPath(req.nextUrl.searchParams.get('next'))
  const response = isAuthFlow
    ? NextResponse.redirect(new URL(nextPath ?? AUTHENTICATED_HOME_PATH, req.url))
    : NextResponse.next()
  if (resolved.refreshed) await setSessionCookies(response.cookies, resolved.session)
  return response
}

export const config = {
  // Never invoked for static files, Next internals, API routes or the Sentry tunnel — none of them needs auth.
  // eslint-disable-next-line unicorn/prefer-string-raw -- Next parses this export statically: it must stay a plain string literal
  matcher: ['/((?!api|_next|monitoring|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|mp4|webm|mov|woff2?|ttf|otf|eot|json|txt|xml|pdf|zip|map)$).*)']
}
