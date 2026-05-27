import 'server-only'
import { DOMAIN } from '@/constants/env'
import type { NextRequest } from 'next/server'

// CSRF defense-in-depth for POST/PUT/PATCH/DELETE handlers.
// Allows missing Origin (server-to-server, curl, e2e); rejects cross-origin browser requests.
export function isValidOrigin (req: NextRequest | Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  return origin === DOMAIN
}
