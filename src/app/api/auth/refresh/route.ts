import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { refreshToken } from '@/api/users'
import { AUTH_COOKIE_NAME } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'

export async function POST () {
  const cookieStore = await cookies()

  try {
    const session = await getServerSession()

    const response = await refreshToken({
      refresh: session.refresh
    })
    console.log(response)

    if(response.ok) {
      return NextResponse.json({
        message: 'Token refreshed'
      }, {
        status: 200
      })
    } else {
      cookieStore.delete(AUTH_COOKIE_NAME)

      return NextResponse.json({
        message: 'Refresh token failed'
      }, {
        status: 401
      })
    }
  } catch (error) {
    cookieStore.delete(AUTH_COOKIE_NAME)
    return NextResponse.json({
      message: error.message
    }, {
      status: 401
    })
  }
}