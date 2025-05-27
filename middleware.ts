import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET })

    const { pathname } = req.nextUrl

    const PUBLIC_PATHS = [
      '/login',
      '/signup',
      '/public',
      '/_next',
      '/favicon.ico',
      '/email-validation',
      '/recovery-password',
    ]

    const PUBLIC_CLIENT_PATHS = [
      '/login',
      '/signup',
      '/email-validation',
      '/recovery-password',
    ]

    const API_PUBLIC_PATHS = [
      '/api/auth/*',
      '/api/*'
    ]

    const STATIC_RESOURCES = [
      /\.(png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|otf|eot|json|map)$/i
    ]

    // 1. If the user is authenticated and tries to access a public client path (login, signup, etc.), redirect to the home page
    if (token && PUBLIC_CLIENT_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // 2. Allow access to public paths or API routes without authentication
    if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.next()
    }

    // 3. Allow access to public API routes
    if (API_PUBLIC_PATHS.some(path => pathname.match(new RegExp(`^${path.replace('*', '.*')}$`)))) {
      return NextResponse.next()
    }

    // 4. Allow access to static resources
    if (STATIC_RESOURCES.some(regex => regex.test(pathname))) {
      return NextResponse.next()
    }

    // 5. If no token is present, redirect to the login page
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // 7. If the user is authenticated and everything is fine, proceed with the request
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/:path*'
}