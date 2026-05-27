import 'server-only'
import { DOMAIN } from '@/constants/env'
import type { NextRequest } from 'next/server'

// CSRF guard. Allows missing Origin (server-to-server, e2e); rejects cross-origin browsers.
export function isValidOrigin (req: NextRequest | Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  return origin === DOMAIN
}
