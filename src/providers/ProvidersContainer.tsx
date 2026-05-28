'use client'
import * as Sentry from '@sentry/nextjs'
import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion'
import { useRouter } from 'next/navigation'
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

// PrimeReact ES locale setup — kicked off at module evaluation so the JSON
// downloads in parallel with the rest of the client bundle. Calendar's locale
// lookup happens at render time, and dashboard screens (the only place it's
// used) mount well after this resolves in practice.
if (typeof window !== 'undefined') {
  import('primelocale/es.json')
    .then(({ es }) => addLocale('es', es))
    .catch((error) => console.error('Failed to load PrimeReact ES locale', error))
}

const ProvidersContainer = ({ token, user, children }: Props) => {
  const { setToken, setUser, removeToken, removeUser } = useUserStore()
  const authListener = useRef<string | null>(null)
  const router = useRouter()


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

  // Polling: session cookie is httpOnly, so storage/BroadcastChannel can't observe it.
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
      <MotionConfig reducedMotion='user'>
        <LazyMotion features={domAnimation} strict>
          { children }
        </LazyMotion>
      </MotionConfig>

      <ModalsProvider/>
    </PrimeReactProvider>
  )
}

export default ProvidersContainer
