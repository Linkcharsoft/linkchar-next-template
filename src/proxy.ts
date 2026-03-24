import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME, AUTH_TOKEN_ERRORS, AUTHENTICATED_HOME_PATH } from '@/constants/auth'
import { getAccessToken } from '@/utils/auth'
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

export async function proxy (req: NextRequest) {
  const { pathname } = req.nextUrl

  // ⛔ Ignore static resources
  if (STATIC_RESOURCES_REGEX.test(pathname)) return NextResponse.next()
  // ⛔ Ignore API routes
  if (pathname.startsWith('/api')) return NextResponse.next()
  // ⛔ Ignore Next.js chunks
  if (pathname.startsWith('/_next')) return NextResponse.next()
  // ⛔ Ignore public paths
  // if ([...PUBLIC_PATHS].some(path => pathname.includes(path))) return NextResponse.next()
  if ([...PUBLIC_PATHS].some(path => path === pathname)) return NextResponse.next()

  const isAuthFlow = [...AUTH_PATHS].some(path => pathname.includes(path))

  try {
    const authCookie = req.cookies.get(SESSION_COOKIE_NAME)
    const listenerCookie = req.cookies.get(LISTENER_COOKIE_NAME)

    // 🔄 Check if both auth cookies exist or not - if one exists and the other doesn't, delete both
    if ((authCookie && !listenerCookie) || (!authCookie && listenerCookie)) {
      const response = NextResponse.redirect(new URL('/login', req.url))
      response.cookies.delete(SESSION_COOKIE_NAME)
      response.cookies.delete(LISTENER_COOKIE_NAME)
      return response
    }

    // 🔄 If there is no auth cookie and tries to acces a protected path, redirect to login
    if(!authCookie && !isAuthFlow) return NextResponse.redirect(new URL('/login', req.url))

    const token = await getAccessToken()

    // 🔄 If there is token and tries to access a auth path, redirect to the authenticated home path
    if(token && isAuthFlow) {
      return NextResponse.redirect(new URL(AUTHENTICATED_HOME_PATH, req.url))
    }

    // ✅ If the user is authenticated and everything is fine, proceed with the request
    return NextResponse.next()
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_TOKEN_ERRORS.proxy
    const authErrors = Object.values(AUTH_TOKEN_ERRORS)

    // 🔄 If there is no token, redirect to login
    if(authErrors.includes(message)) {
      console.error('Middleware error:', error)

      if(!isAuthFlow) return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
  }
}

export const config = {
  matcher: '/:path*'
}