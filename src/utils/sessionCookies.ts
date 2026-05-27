import 'server-only'
import { LISTENER_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/constants/auth'
import { encryptSession } from './crypto'
import type { SessionType } from '@/types/auth'

type CookieSetter = {
  set: (name: string, value: string, options: Record<string, unknown>) => void
  delete: (name: string) => void
}

const SHARED_COOKIE_OPTIONS = {
  secure: true,
  path: '/' as const,
  sameSite: 'strict' as const,
  priority: 'high' as const
}

// Heads up: the encrypted session ends up close to 4KB if the backend issues very large
// JWTs (lots of claims). Browsers will reject anything over that — keep an eye on token size.
export async function setSessionCookies (target: CookieSetter, session: SessionType) {
  const encryptedSession = await encryptSession(session)
  const refreshExpiration = new Date(session.refresh_expiration)
  const maxAge = Math.floor((refreshExpiration.getTime() - Date.now()) / 1000)

  target.set(SESSION_COOKIE_NAME, encryptedSession, {
    ...SHARED_COOKIE_OPTIONS,
    httpOnly: true,
    expires: refreshExpiration,
    maxAge
  })
  target.set(LISTENER_COOKIE_NAME, Date.now().toString(), {
    ...SHARED_COOKIE_OPTIONS,
    httpOnly: false,
    expires: refreshExpiration,
    maxAge
  })
}

export function clearSessionCookies (target: CookieSetter) {
  target.delete(SESSION_COOKIE_NAME)
  target.delete(LISTENER_COOKIE_NAME)
}
