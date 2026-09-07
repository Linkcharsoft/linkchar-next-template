import 'server-only'
import { APP_ENV, DOMAIN } from '@/constants/env'
import type { NextRequest } from 'next/server'

const toOrigin = (value: string | null | undefined): string | null => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

// CSRF guard. Allows missing Origin (server-to-server, e2e); rejects cross-origin browsers.
export function isValidOrigin (req: NextRequest | Request): boolean {
  const rawOrigin = req.headers.get('origin')
  if (!rawOrigin) return true

  // Normalized comparison — a trailing slash or path in NEXT_PUBLIC_DOMAIN must not 403 every login.
  const origin = toOrigin(rawOrigin)
  if (!origin) return false

  if (origin === toOrigin(DOMAIN)) return true

  return APP_ENV === 'development' && LOCAL_HOSTNAMES.has(new URL(origin).hostname)
}
