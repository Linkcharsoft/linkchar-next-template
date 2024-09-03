// types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: number | string 
      accessToken?: string
      refreshToken?: string
      accessTokenExpires?: number
      refreshTokenExpires?: number
    } & DefaultSession['user']
  }

  interface User {
    id: number | string 
    access: string
    refresh: string
    access_expiration: string
    refresh_expiration: string
  }
}
