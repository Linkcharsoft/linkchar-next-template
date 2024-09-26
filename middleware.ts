import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

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

    // Check if the request is for a public client path and the user is logged in
    if ((PUBLIC_CLIENT_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) && token) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // // If the user is registered, redirect them to the home page
    // if (pathname === '/complete-profile' && token && token.is_register_complete) {
    //   return NextResponse.redirect(new URL('/', req.url))
    // }

    // Check if the request is for a public path or an API route
    if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.next()
    }

    // Check if the request is for a static resource
    if (API_PUBLIC_PATHS.some(path => pathname.match(new RegExp(`^${path.replace('*', '.*')}$`)))) {
      return NextResponse.next()
    }

    // Check if the request is for a static resource
    if (STATIC_RESOURCES.some(regex => regex.test(pathname))) {
      return NextResponse.next()
    }

    // If the request is not for a public path, authenticate the user
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // // If the user is not registered, redirect them to the complete profile page
    // if (pathname !== '/complete-profile' && token && !token.is_register_complete) {
    //   return NextResponse.redirect(new URL('/complete-profile', req.url))
    // }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/:path*'
}