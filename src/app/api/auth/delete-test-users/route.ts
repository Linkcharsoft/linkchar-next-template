import { NextResponse } from 'next/server'
import { AUTH_ERRORS } from '@/constants/auth'
import { API_URL, APP_ENV } from '@/constants/env'
import { isValidOrigin } from '@/utils/validateOrigin'
import type { NextRequest } from 'next/server'

// E2E-only endpoint — 404 in production.
export async function DELETE (req: NextRequest) {
  if (APP_ENV === 'production') {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 })
  }

  if (!isValidOrigin(req)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  try {
    const response = await fetch(`${API_URL}/api/users/delete-test-users/`, {
      method: 'DELETE'
    })

    if(response.ok) {
      return NextResponse.json({
        message: 'Test users deleted'
      }, {
        status: 200
      })
    } else {
      throw new Error(AUTH_ERRORS['delete-test-users'])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['delete-test-users']
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  }
}
