import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME, AUTH_ERRORS, AUTHENTICATED_HOME_PATH } from '@/constants/auth'
import { API_URL } from '@/constants/env'
import { decryptSession, encryptSession } from '@/utils/crypto'
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

const PUBLIC_PATHS = new Set([
  '/',
  '/sentry-example-page' // Delete
])

const STATIC_RESOURCES_REGEX = /\.(png|jpg|jpeg|svg|webp|ico|gif|mp4|webm|mov|woff2?|ttf|otf|eot|json|txt|xml|pdf|zip|map)$/i

const REFRESH_THRESHOLD_SECONDS = 60

async function refreshAccessToken (session: SessionType): Promise<SessionType | null> {
  try {
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
  } catch {
    return null
  }
}

async function applySessionCookies (response: NextResponse, session: SessionType) {
  const encryptedSession = await encryptSession(session)
  const refreshExpiration = new Date(session.refresh_expiration)
  const maxAge = Math.floor((refreshExpiration.getTime() - Date.now()) / 1000)

  response.cookies.set(SESSION_COOKIE_NAME, encryptedSession, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    priority: 'high',
    expires: refreshExpiration,
    maxAge
  })
  response.cookies.set(LISTENER_COOKIE_NAME, Date.now().toString(), {
    httpOnly: false,
    secure: true,
    path: '/',
    sameSite: 'strict',
    priority: 'high',
    expires: refreshExpiration,
    maxAge
  })
}

function clearSessionCookies (response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME)
  response.cookies.delete(LISTENER_COOKIE_NAME)
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
  if ([...PUBLIC_PATHS].some(path => path === pathname)) return NextResponse.next()

  const isAuthFlow = [...AUTH_PATHS].some(path => pathname === path || pathname.startsWith(`${path}/`))

  const authCookie = req.cookies.get(SESSION_COOKIE_NAME)
  const listenerCookie = req.cookies.get(LISTENER_COOKIE_NAME)

  // 🔄 If only one of the two auth cookies exists, the pair is corrupt — purge both
  if ((authCookie && !listenerCookie) || (!authCookie && listenerCookie)) {
    const response = NextResponse.redirect(new URL('/login', req.url))
    clearSessionCookies(response)
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
      clearSessionCookies(response)
      return response
    }
    const response = NextResponse.redirect(new URL('/login', req.url))
    clearSessionCookies(response)
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
        clearSessionCookies(response)
        return response
      }
    }
  } catch (error) {
    console.error('Proxy refresh check failed:', error)
  }

  // ✅ Authenticated user landing on an auth flow → bounce to home
  if (isAuthFlow) {
    const response = NextResponse.redirect(new URL(AUTHENTICATED_HOME_PATH, req.url))
    if (sessionRefreshed) await applySessionCookies(response, activeSession)
    return response
  }

  // ✅ Authenticated user on a protected route → proceed
  const response = NextResponse.next()
  if (sessionRefreshed) await applySessionCookies(response, activeSession)
  return response
}

export const config = {
  matcher: '/:path*'
}
