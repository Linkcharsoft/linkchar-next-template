import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logout } from '@/api/auth'
import { SESSION_COOKIE_NAME, LISTENER_COOKIE_NAME, AUTH_ERRORS } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'

export async function POST () {
  try {
    const session = await getServerSession()

    const response = await logout(session.access)

    if(response.ok) {
      revalidatePath('/', 'layout')

      return NextResponse.json({
        message: 'Logout successful'
      }, {
        status: 200
      })
    } else {
      throw new Error(AUTH_ERRORS.logout)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS.logout
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  } finally {
    const cookieStore = await cookies()

    cookieStore.delete(SESSION_COOKIE_NAME)
    cookieStore.delete(LISTENER_COOKIE_NAME)
  }
}