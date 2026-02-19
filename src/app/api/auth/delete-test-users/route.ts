import { NextResponse } from 'next/server'
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
      throw new Error('Test users not deleted')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json(
      { message },
      { status: 400 }
    )
  }
}