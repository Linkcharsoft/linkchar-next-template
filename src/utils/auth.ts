'use server'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_NAME, AUTH_TOKEN_ERRORS } from '@/constants'
import { UserType } from '@/types/auth'
import { decryptSession } from './crypto'

export const getServerSession = async () => {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value

    if(!sessionCookie) {
      throw new Error(AUTH_TOKEN_ERRORS['not-found'])
    }

    const session = await decryptSession(sessionCookie)
    if(!session) {
      throw new Error(AUTH_TOKEN_ERRORS['invalid'])
    }

    return session
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_TOKEN_ERRORS['general']
    throw new Error(message)
  }
}

export const getAccessToken = async () => {
  const session = await getServerSession()

  return session.access
}

export const getServerUser = async (): UserType | null => {
  const origin = process.env.__NEXT_PRIVATE_ORIGIN

  if(!origin) return
  // throw new Error('Origin not defined. Are you calling getServerUser on the server?')

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? ''

  const res = await fetch(`${origin}/api/auth/me/`, {
    method: 'GET',
    headers: {
      Cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) return null

  return res.json()
}

