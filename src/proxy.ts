import { NextResponse } from 'next/server'
import { AUTH_ERRORS, AUTHENTICATED_HOME_PATH, SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME } from '@/constants/auth'
import { API_URL } from '@/constants/env'
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

const STATIC_RESOURCES_REGEX = /\.(png|jpg|jpeg|svg|webp|ico|gif|mp4|webm|mov|woff2?|ttf|otf|eot|json|txt|xml|pdf|zip|map)$/i

const REFRESH_THRESHOLD_SECONDS = 60

// Per-instance dedup so concurrent requests inside the same edge worker share a single refresh.
// Each edge instance has its own Map — multi-instance deploys don't dedup across instances.
// In practice that's fine: each request hits a single instance, and the worst case is
// O(instances) refreshes per token rotation rather than O(tabs). The Maps are small (one entry
// per refresh token) and naturally evict as instances recycle on cold starts / deploys / idle.
const refreshInFlight = new Map<string, Promise<SessionType | null>>()
const refreshCache = new Map<string, { result: SessionType | null, timestamp: number }>()
const REFRESH_CACHE_TTL_MS = 10_000

async function refreshAccessToken (session: SessionType): Promise<SessionType | null> {
  const cached = refreshCache.get(session.refresh)
  if (cached && Date.now() - cached.timestamp < REFRESH_CACHE_TTL_MS) {
    return cached.result
  }

  const inFlight = refreshInFlight.get(session.refresh)
  if (inFlight) return inFlight

  const promise = (async (): Promise<SessionType | null> => {
    const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: session.refresh }),
      cache: 'no-store'
    })

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
    setTimeout(() => refreshCache.delete(session.refresh), REFRESH_CACHE_TTL_MS)
    return result
  } catch (error) {
    console.error('Proxy refresh network error:', error)
    return null
  } finally {
    refreshInFlight.delete(session.refresh)
  }
}

export async function proxy (req: NextRequest) {
  const { pathname } = req.nextUrl

  // ⛔ Ignore static resources
  if (STATIC_RESOURCES_REGEX.test(pathname)) return NextResponse.next()
  // ⛔ Ignore API routes
  if (pathname.startsWith('/api')) return NextResponse.next()
  // ⛔ Ignore Next.js chunks
  if (pathname.startsWith('/_next')) return NextResponse.next()
  // ⛔ Ignore public paths (exact match)
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const isAuthFlow = AUTH_PATHS.has(pathname) || AUTH_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix))

  const authCookie = req.cookies.get(SESSION_COOKIE_NAME)
  const listenerCookie = req.cookies.get(LISTENER_COOKIE_NAME)

  // 🔄 If only one of the two auth cookies exists, the pair is corrupt — purge both
  if ((authCookie && !listenerCookie) || (!authCookie && listenerCookie)) {
    const response = NextResponse.redirect(new URL('/login', req.url))
    clearSessionCookies(response.cookies)
    return response
  }

  // 🔄 No session at all
  if (!authCookie) {
    if (!isAuthFlow) return NextResponse.redirect(new URL('/login', req.url))
    return NextResponse.next()
  }

  // 🔓 Decrypt session
  let session: SessionType | null = null
  try {
    session = await decryptSession(authCookie.value)
  } catch (error) {
    console.error('Proxy session decryption failed:', error)
  }

  if (!session) {
    if (isAuthFlow) {
      const response = NextResponse.next()
      clearSessionCookies(response.cookies)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', req.url))
    clearSessionCookies(response.cookies)
    return response
  }

  // ♻️ Proactive refresh — keeps access token alive ahead of expiry
  let activeSession: SessionType = session
  let sessionRefreshed = false

  try {
    const accessExp = new Date(session.access_expiration).getTime()
    const secondsLeft = (accessExp - Date.now()) / 1000

    if (secondsLeft < REFRESH_THRESHOLD_SECONDS) {
      const refreshed = await refreshAccessToken(session)
      if (refreshed) {
        activeSession = refreshed
        sessionRefreshed = true
      } else {
        // Refresh failed — refresh token expired or revoked. Kill the session.
        console.error(AUTH_ERRORS['refresh-token'])
        const response = NextResponse.redirect(new URL('/login', req.url))
        clearSessionCookies(response.cookies)
        return response
      }
    }
  } catch (error) {
    console.error('Proxy refresh check failed:', error)
  }

  // ✅ Authenticated user landing on an auth flow → bounce to home
  if (isAuthFlow) {
    const response = NextResponse.redirect(new URL(AUTHENTICATED_HOME_PATH, req.url))
    if (sessionRefreshed) await setSessionCookies(response.cookies, activeSession)
    return response
  }

  // ✅ Authenticated user on a protected route → proceed
  const response = NextResponse.next()
  if (sessionRefreshed) await setSessionCookies(response.cookies, activeSession)
  return response
}

export const config = {
  matcher: '/:path*'
}
