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
  token?: string | null
  user?: UserType | null
  children: ReactNode
}

// PrimeReact ES locale setup
addLocale('es', es)

const ProvidersContainer = ({ token, user, children }: Props) => {
  const { setToken, setUser, removeToken, removeUser } = useUserStore()
  const authListener = useRef<string | null>(null)
  const router = useRouter()


  // Three-way auth state: keep token alone when `/users/me` fails (transient backend issue)
  // so the user isn't visually logged out by a 5xx; only a missing token is treated as logout.
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

  // Polling is required: the session cookie is httpOnly, so storage/BroadcastChannel events
  // can't observe it. The non-httpOnly listener cookie is updated in lockstep on every change.
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
        authListener.current = currentListener
        router.refresh()
      }
    }, 2000)

    return () => clearInterval(intervalId)
  }, [])

  // Clarity setup
  useEffect(() => {
    // if (!CLARITY_ID || APP_ENV !== 'production') return
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
