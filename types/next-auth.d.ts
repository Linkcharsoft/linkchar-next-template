import { UserType } from './auth'

declare module 'next-auth' {
  interface Session {
    error: boolean
    user: Partial<UserType>
  }

  type User = UserType
  type AdapterUser = UserType
}
