import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { login } from '@/api/users'
import { AUTH_COOKIE_NAME } from '@/constants'
import { SessionType } from '@/types/auth'
import { encryptSession } from '@/utils/crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const response = await login(body)

    if(response.ok) {
      const session: SessionType = {
        access: response.data.access,
        refresh: response.data.refresh,
        access_expiration: response.data.access_expiration,
        refresh_expiration: response.data.refresh_expiration,
        id: response.data?.user?.id
      }

      // Returns error if key session data is missing
      if(Object.values(session).some(value => value === undefined)) {
        return NextResponse.json({
          message: 'Invalid session'
        }, {
          status: 400
        })
      }

      // Encrypts the session for greater security using double encryption
      const encryptedSession = await encryptSession(session)

      // Set the expiration of session cookie
      const refreshExpiration = new Date(session.refresh_expiration)
      const maxAge = Math.floor((refreshExpiration.getTime() - Date.now()) / 1000)

      // Set session cookie
      const cookieStore = await cookies()
      cookieStore.set(AUTH_COOKIE_NAME, encryptedSession, {
        httpOnly: true,
        secure: true,
        path: '/',
        sameSite: 'strict',
        priority: 'high',
        expires: refreshExpiration,
        maxAge,
      })

      return NextResponse.json(response.data.user, {
        status: 200,
      })
    } else {
      const status = response?.response?.status ?? 400
      return NextResponse.json(response.error, {
        status,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  }
}