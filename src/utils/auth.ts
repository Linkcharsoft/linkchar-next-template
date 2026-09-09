import 'server-only'
import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { getMyUser } from '@/api/auth'
import { SESSION_COOKIE_NAME } from '@/constants/auth'
import { captureError } from './captureError'
import { decryptSession } from './crypto'
import type { SessionType, UserType } from '@/types/auth'

// cache(): one decrypt and one /users/me per request, however many layouts and pages ask.
export const getServerSession = cache(async (): Promise<SessionType | null> => {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) return null

    return await decryptSession(sessionCookie)
  } catch (error) {
    unstable_rethrow(error)
    captureError('get-server-session', error)
    return null
  }
})

export const getAccessToken = async (): Promise<string | null> => {
  const session = await getServerSession()
  return session?.access ?? null
}

export const getServerUser = cache(async (): Promise<UserType | null> => {
  const token = await getAccessToken()
  if (!token) return null

  try {
    const { ok, data } = await getMyUser(token)
    return ok ? data : null
  } catch (error) {
    unstable_rethrow(error)
    captureError('get-server-user', error)
    return null
  }
})
