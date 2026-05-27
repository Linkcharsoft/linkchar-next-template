'use server'
import { cookies } from 'next/headers'
import { getMyUser } from '@/api/auth'
import { SESSION_COOKIE_NAME, AUTH_ERRORS } from '@/constants/auth'
import { decryptSession } from './crypto'
import type { UserType } from '@/types/auth'


export const getServerSession = async () => {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if(!sessionCookie) {
      throw new Error(AUTH_ERRORS['session-not-found'])
    }

    const session = await decryptSession(sessionCookie)
    if(!session) {
      throw new Error(AUTH_ERRORS['session-invalid'])
    }

    return session
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['session-general']
    throw new Error(message)
  }
}

export const getAccessToken = async (): Promise<string | undefined> => {
  let token

  try {
    const session = await getServerSession()
    token = session.access
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['session-general']
    throw new Error(message)
  }

  return token
}

export const getServerUser = async (): Promise<UserType | undefined> => {
  try {
    const token = await getAccessToken()
    if (!token) return undefined

    const { ok, data } = await getMyUser(token)
    return ok ? data : undefined
  } catch {
    return undefined
  }
}

