import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getMyUser } from '@/api/auth'
import { AUTH_COOKIE_NAME } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'

export async function GET () {
  try {
    const session = await getServerSession()

    const response = await getMyUser(session.access)

    if(response.ok) {
      return NextResponse.json(response.data, {
        status: 200
      })
    } else {
      const cookieStore = await cookies()
      cookieStore.delete(AUTH_COOKIE_NAME)

      return NextResponse.json({
        message: 'User not found'
      }, {
        status: 400
      })
    }
  } catch (error) {
    const cookieStore = await cookies()
    cookieStore.delete(AUTH_COOKIE_NAME)

    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  }
}