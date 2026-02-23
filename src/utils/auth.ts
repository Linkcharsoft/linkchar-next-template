'use server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, AUTH_TOKEN_ERRORS } from '@/constants/auth'
import { DOMAIN } from '@/constants/env'
import { decryptSession } from './crypto'
import type { UserType } from '@/types/auth'


export const getServerSession = async () => {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

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

export const getAccessToken = async (): Promise<string | undefined> => {
  let token

  try {
    const session = await getServerSession()
    token = session.access
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_TOKEN_ERRORS['general']
    throw new Error(message)
  }

  return token
}

export const getServerUser = async (): Promise<UserType | undefined> => {
  if(!DOMAIN) throw new Error('Domain not found')

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? ''

  const res = await fetch(`${DOMAIN}/api/auth/me/`, {
    method: 'GET',
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`
    },
    cache: 'no-store'
  })

  if (!res.ok) return undefined

  return res.json()
}

