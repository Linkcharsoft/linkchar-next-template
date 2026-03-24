import { NextResponse } from 'next/server'
import { getMyUser } from '@/api/auth'
import { AUTH_ERRORS } from '@/constants/auth'
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
      throw new Error(AUTH_ERRORS['user-not-found'])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['user-not-found']
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  }
}