import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { refreshToken } from '@/api/auth'
import { AUTH_COOKIE_NAME, AUTH_LISTENER_NAME } from '@/constants/auth'
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
      cookieStore.set(AUTH_COOKIE_NAME, encryptedSession, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'strict',
        priority: 'high',
        expires: refreshExpiration,
        maxAge
      })
      cookieStore.set(AUTH_LISTENER_NAME, Date.now().toString(), {
        httpOnly: false,
        secure: true,
        path: '/',
        sameSite: 'strict',
        priority: 'high'
      })

      revalidatePath('/', 'layout')

      return NextResponse.json({
        message: 'Token refreshed',
        token: updatedSession.access
      }, {
        status: 200
      })
    } else {
      throw new Error('Error refreshing token')
    }
  } catch (error) {
    return NextResponse.json({
      message: error.message
    }, {
      status: 401
    })
  }
}