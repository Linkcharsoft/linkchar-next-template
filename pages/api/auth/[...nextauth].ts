import NextAuth, { DefaultSession, Session, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'
import { API_URL, NEXTAUTH_SECRET } from '../../../src/constants'

interface ExtendedUser extends User {
  access: string
  refresh: string
  access_expiration: string
  refresh_expiration: string
  user_id: number 
  email: string | null
  first_name: string | null
  last_name: string | null
}

interface ExtendedJWT extends JWT {
  access?: string
  refresh?: string
  access_expiration?: number
  refresh_expiration?: number
  error?: boolean
  user_id?: number
  email?: string | null
  first_name?: string | null
  last_name?: string | null
}

interface ProfileSession extends Session {
  error?: boolean
  user: {
    access?: string
    refresh?: string
    access_expiration?: number
    refresh_expiration?: number
    user_id?: number
    email?: string | null
    first_name?: string | null
    last_name?: string | null
  } & DefaultSession['user']
}

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      authorize: async (credentials) => {
        const { email, password } = credentials || {}

        if (!email || !password) {
          return null
        }

        const res = await fetch(`${API_URL}api/auth/login/`, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
          headers: { 'Content-Type': 'application/json' }
        })

        const user = await res.json()

        if (!res.ok) {
          throw new Error(user.non_field_errors?.[0] || 'Invalid credentials')
        }

        if (res.ok && user) {
          return {
            ...user.user,
            access: user.access,
            refresh: user.refresh,
            access_expiration: user.access_expiration,
            refresh_expiration: user.refresh_expiration,
            user_id: user.user?.id,
            email: user.user?.email,
            first_name: user.user?.first_name,
            last_name: user.user?.last_name,
          } as ExtendedUser
        }

        return null
      }
    })
  ],
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 3 * 24 * 60 * 60,
    updateAge: 5 * 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: { token: ExtendedJWT; user?: User | ExtendedUser; trigger?: string; session?: any }) {
      if (user) {
        const extendedUser = user as ExtendedUser
        token.access = extendedUser.access
        token.refresh = extendedUser.refresh
        token.access_expiration = new Date(extendedUser.access_expiration).getTime()
        token.refresh_expiration = new Date(extendedUser.refresh_expiration).getTime()
        token.user_id = extendedUser.user_id
        token.email = extendedUser.email
        token.first_name = extendedUser.first_name
        token.last_name = extendedUser.last_name
      }

      if (trigger === 'update' && session?.first_name !== undefined && session?.last_name !== undefined) {
        token.first_name = session.first_name
        token.last_name = session.last_name
      }
      
      if (Date.now() > (token.access_expiration || 0)) {
        try {
          const res = await fetch(`${API_URL}api/auth/token/refresh/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh: token.refresh_token })
          })

          const refreshedTokens = await res.json()

          if (!res.ok) throw refreshedTokens

          token.access = refreshedTokens.access
          token.access_expiration = new Date(refreshedTokens.access_expiration).getTime()
        } catch (error) {
          console.error('Error refreshing token:', error)
          token.error = true
        }
      }

      return token
    },

    async session({
      session,
      token
    }: {
      session: Session & Partial<ProfileSession>
      token: ExtendedJWT
    }): Promise<Session | ProfileSession> {
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
        }
      }

      return session
    }
  }
})
