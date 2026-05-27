import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { refreshToken } from '@/api/auth'
import { SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME, AUTH_ERRORS } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'
import { encryptSession } from '@/utils/crypto'
import type { SessionType } from '@/types/auth'

export async function POST () {
  try {
    const cookieStore = await cookies()
    const session = await getServerSession()

    const response = await refreshToken({
      refresh: session.refresh
    })

    if(response.ok) {
      // Update session with new access token and expiration
      const updatedSession: SessionType = {
        ...session,
        access: response.data.access,
        access_expiration: response.data.access_expiration
      }

      // Reencrypts the session
      const encryptedSession = await encryptSession(updatedSession)

      // Set the expiration of session cookie
      const refreshExpiration = new Date(updatedSession.refresh_expiration)
      const maxAge = Math.floor((refreshExpiration.getTime() - Date.now()) / 1000)

      // Set updated session cookie
      cookieStore.set(SESSION_COOKIE_NAME, encryptedSession, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'strict',
        priority: 'high',
        expires: refreshExpiration,
        maxAge
      })
      cookieStore.set(LISTENER_COOKIE_NAME, Date.now().toString(), {
        httpOnly: false,
        secure: true,
        path: '/',
        sameSite: 'strict',
        priority: 'high',
        expires: refreshExpiration,
        maxAge
      })

      revalidatePath('/', 'layout')

      return NextResponse.json({
        message: 'Token refreshed',
        token: updatedSession.access
      }, {
        status: 200
      })
    } else {
      throw new Error(AUTH_ERRORS['refresh-token'])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['refresh-token']
    return NextResponse.json(
      { message },
      { status: 401 }
    )
  }
}