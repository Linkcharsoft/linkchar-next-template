import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logout } from '@/api/auth'
import { AUTH_ERRORS } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'
import { clearSessionCookies } from '@/utils/sessionCookies'
import { isValidOrigin } from '@/utils/validateOrigin'
import type { NextRequest } from 'next/server'

export async function POST (req: NextRequest) {
  if (!isValidOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  try {
    const session = await getServerSession()

    if (session) {
      const response = await logout(session.access)
      if (!response.ok) throw new Error(AUTH_ERRORS.logout)
    }

    revalidatePath('/', 'layout')

    return NextResponse.json({
      message: 'Logout successful'
    }, {
      status: 200
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS.logout
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  } finally {
    const cookieStore = await cookies()
    clearSessionCookies(cookieStore)
  }
}
