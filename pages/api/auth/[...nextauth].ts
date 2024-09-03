import NextAuth, { Session, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'
import { signOut } from 'next-auth/react'
import { API_URL } from '../../../src/constants'

interface ExtendedJWT extends JWT {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  refreshTokenExpires?: number
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
        const res = await fetch(`${API_URL}/api/auth/login/`, {
          method: 'POST',
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password
          }),
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
          }
        }

        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: { token: ExtendedJWT; user?: User }) {
      if (user) {
        token.accessToken = user.access
        token.refreshToken = user.refresh
        token.accessTokenExpires = new Date(user.access_expiration).getTime()
        token.refreshTokenExpires = new Date(user.refresh_expiration).getTime()
      }

      const isTokenValid = await fetch(`${API_URL}/api/auth/token/verify/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`
        }
      })

      if (!isTokenValid.ok) {
        console.error('Token no válido. Iniciando sesión...')
        await signOut({ callbackUrl: '/login' })
        return token
      }

      if (Date.now() > (token.accessTokenExpires || 0)) {
        try {
          const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token.refreshToken}`
            }
          })

          const refreshedTokens = await res.json()

          if (!res.ok) throw refreshedTokens

          token.accessToken = refreshedTokens.access
          token.accessTokenExpires = new Date(refreshedTokens.access_expiration).getTime()
          token.refreshTokenExpires = new Date(refreshedTokens.refresh_expiration).getTime()
        } catch (error) {
          console.error('Error al refrescar el token de acceso', error)
          return token
        }
      }

      return token
    },

    async session({ session, token }: { session: Session; token: ExtendedJWT }) {
      session.user.accessToken = token.accessToken as string | undefined
      session.user.refreshToken = token.refreshToken as string | undefined
      session.user.accessTokenExpires = token.accessTokenExpires as number | undefined
      session.user.refreshTokenExpires = token.refreshTokenExpires as number | undefined

      return session
    }
  }
})
