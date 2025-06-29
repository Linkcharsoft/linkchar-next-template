import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { logout } from '@/api/users'
import getServerSession from '@/utils/getServerSession'

export async function POST() {
  try {
    const session = await getServerSession()

    if (!session?.access) {
      return NextResponse.json({ message: 'No access token' }, { status: 400 })
    }

    const response = await logout(session.access)

    if(response.ok) {
      return NextResponse.json({
        message: 'Logout successful'
      }, {
        status: 200
      })
    } else {
      return NextResponse.json({
        message: 'Logout failed'
      }, {
        status: 400
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  } finally {
    const cookieStore = await cookies()

    cookieStore.delete('linkchar-session')
  }
}