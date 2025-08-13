import { NextResponse , NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_ERRORS } from '@/constants'
import { getAccessToken } from '@/utils/auth'

const AUTH_PATHS = new Set([
  '/login',
  '/signup',
  '/signup/email-validation',
  '/signup/confirmation',
  '/recovery-password',
])

const AUTHENTICATED_HOME_PATH: string = '/'

const STATIC_RESOURCES_REGEX = /\.(png|jpg|jpeg|svg|webp|ico|gif|mp4|webm|mov|woff2?|ttf|otf|eot|json|txt|pdf|zip|map)$/i

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ⛔ Ignore static resources
  if (STATIC_RESOURCES_REGEX.test(pathname)) return NextResponse.next()
  // ⛔ Ignore API routes
  if (pathname.startsWith('/api')) return NextResponse.next()
  // ⛔ Ignore Next.js chunks
  if (pathname.startsWith('/_next')) return NextResponse.next()

  const isAuthFlow = [...AUTH_PATHS].some(path => pathname.includes(path))

  try {
    const authCookie = req.cookies.get(AUTH_COOKIE_NAME)
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
    console.error('Middleware error:', error)
    const authErrors = Object.values(AUTH_TOKEN_ERRORS)

    // 🔄 If there is no token, redirect to login
    if(authErrors.includes(error.message) && !isAuthFlow) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
  }
}

export const config = {
  matcher: '/:path*'
}