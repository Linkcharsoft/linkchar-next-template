import 'server-only'
import { cookies } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { getMyUser } from '@/api/auth'
import { SESSION_COOKIE_NAME } from '@/constants/auth'
import { decryptSession } from './crypto'
import type { SessionType, UserType } from '@/types/auth'


export const getServerSession = async (): Promise<SessionType | null> => {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) return null

    const session = await decryptSession(sessionCookie)
    return session
  } catch (error) {
    unstable_rethrow(error)
    console.error('getServerSession failed:', error)
    return null
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  const session = await getServerSession()
  return session?.access ?? null
}

export const getServerUser = async (): Promise<UserType | null> => {
  const token = await getAccessToken()
  if (!token) return null

  try {
    const { ok, data } = await getMyUser(token)
    return ok ? data : null
  } catch (error) {
    unstable_rethrow(error)
    console.error('getServerUser failed:', error)
    return null
  }
}
