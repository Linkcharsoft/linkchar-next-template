'use client'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import useUserStore from '@/stores/userStore'
import type { UserType } from '@/types/auth'

interface Props {
  token?: string | null
  user?: UserType | null
}

// Hydrates the client store + Sentry from the server-fetched session. Returns null.
const AuthHydrator = ({ token, user }: Props) => {
  const { setToken, setUser, removeToken, removeUser } = useUserStore()

  // Keep token alone on transient /users/me failure — only missing token means logout.
  useEffect(() => {
    if (token && user) {
      setToken(token)
      setUser(user)

      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: `${user.first_name} ${user.last_name}`
      })
    } else if (!token) {
      removeToken()
      removeUser()
      Sentry.setUser(null)
    } else {
      setToken(token)
      removeUser()
    }
  }, [token, user])

  return null
}

export default AuthHydrator
