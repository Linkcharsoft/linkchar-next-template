import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    error: boolean
    user: {
      access?: string
      refresh?: string
      access_expiration?: number
      refresh_expiration?: number
      user_id?: number
      email?: string
      first_name?: string
      last_name?: string
    } & DefaultSession['user']
  }
}
