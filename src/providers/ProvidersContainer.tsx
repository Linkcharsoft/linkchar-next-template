'use client'
import * as Sentry from '@sentry/nextjs'
import { domAnimation, LazyMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { es } from 'primelocale/es.json'
import { addLocale, PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { useEffect, useRef } from 'react'
import { LISTENER_COOKIE_NAME } from '@/constants/auth'
import { CLARITY_ID } from '@/constants/env'
import useUserStore from '@/stores/userStore'
import ModalsProvider from './ModalsProvider'
import type { UserType } from '@/types/auth'
import type { ReactNode } from 'react'

interface Props {
  token?: string
  user?: UserType
  children: ReactNode
}

// PrimeReact ES locale setup
addLocale('es', es)

const ProvidersContainer = ({ token, user, children }: Props) => {
  const { setToken, setUser, removeToken, removeUser } = useUserStore()
  const authListener = useRef<string | null>(null)
  const router = useRouter()


  // User data setup. Pair token and user as a single auth state — if either is
  // missing (logout, expired session, /api/auth/me failure), clear both stores
  // and the Sentry user. Avoids leaving Zustand with stale data after logout.
  useEffect(() => {
    if (token && user) {
      setToken(token)
      setUser(user)

      // Set sentry user context on client side
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: `${user.first_name} ${user.last_name}`
      })
    } else {
      removeToken()
      removeUser()
      Sentry.setUser(null)
    }
  }, [token, user])

  // Auth cookie listener
  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const nameLenPlus = (name.length + 1)
      return document.cookie
        .split(';')
        .map(c => c.trim())
        .filter(cookie => cookie.substring(0, nameLenPlus) === `${name}=`)
        .map(cookie => decodeURIComponent(cookie.substring(nameLenPlus)))[0] || null
    }

    authListener.current = getCookie(LISTENER_COOKIE_NAME) || null

    const intervalId = setInterval(() => {
      const currentListener = getCookie(LISTENER_COOKIE_NAME) || null

      if (currentListener !== authListener.current) {
        console.warn('\n\nAuth cookie change detected, refreshing...\n\n')

        authListener.current = currentListener

        router.refresh()
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  // Clarity setup
  useEffect(() => {
    if (!CLARITY_ID) return
    import('@microsoft/clarity').then(({ default: Clarity }) => {
      Clarity.init(CLARITY_ID)
    })
  }, [])


  return (
    <PrimeReactProvider value={{ pt: Tailwind }}>
      <LazyMotion features={domAnimation} strict>
        { children }
      </LazyMotion>

      <ModalsProvider/>
    </PrimeReactProvider>
  )
}

export default ProvidersContainer
