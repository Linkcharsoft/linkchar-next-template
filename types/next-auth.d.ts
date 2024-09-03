import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    error: boolean
    user: {
      accessToken?: string
      refreshToken?: string
      accessTokenExpires?: number
      refreshTokenExpires?: number
    } & DefaultSession['user']
  }
}
