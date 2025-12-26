import { NextResponse } from 'next/server'
import { API_URL } from '@/constants'

export async function DELETE () {
  try {
    const response = await fetch(`${API_URL}/api/users/delete-test-users/`, {
      method: 'DELETE'
    })
    console.log(response)
    if(response.ok) {
      return NextResponse.json({
        message: 'Test users deleted'
      }, {
        status: 200
      })
    } else {
      return NextResponse.json({
        message: 'Test users not deleted'
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
  }
}