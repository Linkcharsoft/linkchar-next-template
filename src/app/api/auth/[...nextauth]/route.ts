import NextAuth, { Session } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import Credentials from 'next-auth/providers/credentials'
import { API_URL, AUTH_SECRET } from '@/constants'
import { UserType } from '../../../../../types/auth'

interface ExtendedUser extends UserType {
  access_expiration: string
  refresh_expiration: string
}

interface ExtendedJWT extends JWT, Partial<UserType> {
  access_expiration?: number
  refresh_expiration?: number
  error?: boolean
}

const handler = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      type: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      authorize: async (credentials): Promise<ExtendedUser | null> => {
        const { email, password } = credentials || {}

        if(!email || !password) throw new Error('Enter email and password')

        console.log(email, password)

        try {
          const response = await fetch(`${API_URL}api/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })
          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.non_field_errors?.[0] || 'Invalid credentials')
          } else if(data) {
            return {
              ...data.user,
              access: data.access,
              refresh: data.refresh,
              access_expiration: data.access_expiration,
              refresh_expiration: data.refresh_expiration,
              user_id: data.user?.id,
            } as ExtendedUser
          }

          return null
        } catch (error) {
          throw new Error(error.message || 'Invalid credentials')
        }
      }
    })
  ],
  secret: AUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 3 * 24 * 60 * 60,
    updateAge: 5 * 24 * 60 * 60
  },
  callbacks: {
    async jwt({
      token,
      user,
      // trigger,
      // session
    }
    // : {
    //   token: ExtendedJWT
    //   user: ExtendedUser
    //   // trigger?: string
    //   // session?: any
    // }
    ) {
      if (user) {
        const extendedUser = user as ExtendedUser

        console.log('\n\n ------- JWT -------- \n\n')

        console.log(token)
        console.log(user)
        token.access = extendedUser.access
        token.refresh = extendedUser.refresh
        token.access_expiration = new Date(extendedUser.access_expiration).getTime()
        token.refresh_expiration = new Date(extendedUser.refresh_expiration).getTime()
        token.user_id = extendedUser.user_id
        token.email = extendedUser.email
        token.first_name = extendedUser.first_name
        token.last_name = extendedUser.last_name
      }

      // if (trigger === 'update' && session?.first_name !== undefined && session?.last_name !== undefined) {
      //   token.first_name = session.first_name
      //   token.last_name = session.last_name
      // }

      // if (Date.now() > (token.access_expiration || 0)) {
      //   if (Date.now() > (token.refresh_expiration || 0)) {
      //     token.error = true
      //     return token
      //   }

      //   try {
      //     const res = await fetch(`${API_URL}api/auth/token/refresh/`, {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json'
      //       },
      //       body: JSON.stringify({ refresh: token.refresh })
      //     })

      //     const refreshedTokens = await res.json()

      //     if (!res.ok) throw refreshedTokens

      //     token.access = refreshedTokens.access
      //     token.access_expiration = new Date(refreshedTokens.access_expiration).getTime()
      //   } catch (error) {
      //     console.error('Error refreshing token:', error)
      //     token.error = true
      //   }
      // }

      return token as ExtendedJWT
    },

    async session({
      session,
      token
    }: {
      session: Session
      token: ExtendedJWT
    }): Promise<Session> {
      if (session.user) {
        session.user.access = token.access
        session.user.refresh = token.refresh
        session.user.access_expiration = token.access_expiration
        session.user.refresh_expiration = token.refresh_expiration
        session.user.user_id = token.user_id
        session.user.email = token.email
        session.user.first_name = token.first_name
        session.user.last_name = token.last_name

        if (token.error) {
          session.error = true
        } else {
          session.error = false
        }
      }

      return session
    }
  }
})

export { handler as GET, handler as POST }