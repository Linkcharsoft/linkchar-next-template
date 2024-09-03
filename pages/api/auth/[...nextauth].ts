import NextAuth, { DefaultSession, Session, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'
import { API_URL, NEXTAUTH_SECRET } from '../../../src/constants'

interface ExtendedUser extends User {
  access: string
  refresh: string
  access_expiration: string
  refresh_expiration: string
}

interface ExtendedJWT extends JWT {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  refreshTokenExpires?: number
}

interface ProfileSession extends Session {
  error?: boolean
  user: {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    refreshTokenExpires?: number
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

        const res = await fetch(`${API_URL}/api/auth/login/`, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
          headers: { 'Content-Type': 'application/json' }
        })

        const user = await res.json()

        if (res.ok && user) {
          return {
            ...user.user,
            access: user.access,
            refresh: user.refresh,
            access_expiration: user.access_expiration,
            refresh_expiration: user.refresh_expiration
          } as ExtendedUser
        }

        return null
      }
    })
  ],
  secret: NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
    updateAge: 24 * 60 * 60
  },
  callbacks: {
    async jwt({ token, user }: { token: ExtendedJWT; user?: User | ExtendedUser }) {
      if (user && 'access' in user && 'refresh' in user) {
        const extendedUser = user as ExtendedUser
        token.accessToken = extendedUser.access
        token.refreshToken = extendedUser.refresh
        token.accessTokenExpires = new Date(extendedUser.access_expiration).getTime()
        token.refreshTokenExpires = new Date(extendedUser.refresh_expiration).getTime()
      }

      if (Date.now() > (token.accessTokenExpires || 0)) {
        try {
          const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh: token.refreshToken })
          })

          const refreshedTokens = await res.json()

          if (!res.ok) throw refreshedTokens

          token.accessToken = refreshedTokens.access
          token.accessTokenExpires = new Date(refreshedTokens.access_expiration).getTime()
          token.refreshTokenExpires = new Date(refreshedTokens.refresh_expiration).getTime()
        } catch (error) {
          console.error('Error refreshing token:', error)
          return { ...token, error: 'RefreshAccessTokenError' }
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
        session.user.accessToken = token.accessToken
        session.user.refreshToken = token.refreshToken
        session.user.accessTokenExpires = token.accessTokenExpires
        session.user.refreshTokenExpires = token.refreshTokenExpires

        if (token.error) {
          session.error = true
        }
      }

      return session
    }
  }
})
