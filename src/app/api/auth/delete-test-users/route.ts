import { NextResponse } from 'next/server'
import { AUTH_ERRORS } from '@/constants/auth'
import { API_URL } from '@/constants/env'

export async function DELETE () {
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