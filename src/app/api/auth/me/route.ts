import { NextResponse } from 'next/server'
import { getMyUser } from '@/api/auth'
import { AUTH_ERRORS } from '@/constants/auth'
import { getServerSession } from '@/utils/auth'

// Reference handler — default template hydrates the user via `getServerUser()` in
// GeneralLayout. Use this from Client Components that need to re-fetch on demand.
export async function GET () {
  try {
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json(
        { message: AUTH_ERRORS['session-not-found'] },
        { status: 401 }
      )
    }

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
