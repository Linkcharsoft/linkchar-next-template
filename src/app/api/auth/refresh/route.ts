import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { refreshToken } from '@/api/auth'
import { AUTH_ERRORS } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'
import { setSessionCookies } from '@/utils/sessionCookies'
import { isValidOrigin } from '@/utils/validateOrigin'
import type { SessionType } from '@/types/auth'
import type { NextRequest } from 'next/server'

export async function POST (req: NextRequest) {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json(
        { message: AUTH_ERRORS['session-not-found'] },
        { status: 401 }
      )
    }

    const response = await refreshToken({
      refresh: session.refresh
    })

    if(response.ok) {
      const updatedSession: SessionType = {
        ...session,
        access: response.data.access,
        access_expiration: response.data.access_expiration
      }

      const cookieStore = await cookies()
      await setSessionCookies(cookieStore, updatedSession)

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
