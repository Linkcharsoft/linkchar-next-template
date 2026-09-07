import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { login } from '@/api/auth'
import { AUTH_ERRORS } from '@/constants/auth'
import { setSessionCookies } from '@/utils/sessionCookies'
import { isValidOrigin } from '@/utils/validateOrigin'
import type { SessionType } from '@/types/auth'
import type { NextRequest } from 'next/server'

export async function POST (req: NextRequest) {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const { email, password } = body ?? {}
  if (
    typeof email !== 'string' || !email || email.length > 320 ||
    typeof password !== 'string' || !password || password.length > 1024
  ) {
    return NextResponse.json({ message: AUTH_ERRORS.login }, { status: 400 })
  }

  try {
    const response = await login({ email, password })

    if(response.ok) {
      const session: SessionType = {
        access: response.data.access,
        refresh: response.data.refresh,
        access_expiration: response.data.access_expiration,
        refresh_expiration: response.data.refresh_expiration,
        id: response.data?.user?.id
      }

      // Returns error if key session data is missing
      // eslint-disable-next-line unicorn/prefer-includes -- Object.values() is typed (string | number)[]; .includes(undefined) would not type-check.
      if(Object.values(session).some(value => value === undefined)) {
        return NextResponse.json({
          message: AUTH_ERRORS['session-invalid']
        }, {
          status: 400
        })
      }

      const cookieStore = await cookies()
      await setSessionCookies(cookieStore, session)

      revalidatePath('/', 'layout')

      return NextResponse.json(response.data.user, {
        status: 200
      })
    } else {
      const status = response?.response?.status ?? 400
      return NextResponse.json(response.error, {
        status
      })
    }
  } catch (error) {
    // Report the real failure to Sentry; the client gets a generic message, never internals.
    Sentry.captureException(error)
    return NextResponse.json(
      { message: AUTH_ERRORS.login },
      { status: 502 }
    )
  }
}
