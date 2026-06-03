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
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

// PrimeReact ES locale setup
if (typeof window !== 'undefined') {
  import('primelocale/es.json')
    .then(({ es }) => addLocale('es', es))
    .catch((error) => console.error('Failed to load PrimeReact ES locale', error))
}

const ProvidersContainer = ({ children }: Props) => {
  const { removeToken, removeUser } = useUserStore()
  const authListener = useRef<string | null>(null)
  const router = useRouter()

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

        // Session ended: clear the store (static routes don't mount AuthHydrator).
        if (!currentListener) {
          removeToken()
          removeUser()
          Sentry.setUser(null)
        }

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
