'use client'
import Clarity from '@microsoft/clarity'
import * as Sentry from '@sentry/nextjs'
import { domAnimation, LazyMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { addLocale, PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { useEffect, useRef } from 'react'
import { AUTH_LISTENER_NAME } from '@/constants/auth'
import useUserStore from '@/stores/userStore'
import ModalsProvider from './ModalsProvider'
import type { UserType } from '@/types/auth'
import type { ReactNode } from 'react'

interface Props {
  token?: string
  user?: UserType
  children: ReactNode
}

const ProvidersContainer = ({ token, user, children }: Props) => {
  const { setToken, setUser } = useUserStore()
  const authListener = useRef<string | null>(null)
  const router = useRouter()


  // User data setup
  useEffect(() => {
    if(token) setToken(token)
    if(user) {
      setUser(user)

      // Set sentry user context on client side
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: `${user.first_name} ${user.last_name}`
      })
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

    authListener.current = getCookie(AUTH_LISTENER_NAME) || null

    const intervalId = setInterval(() => {
      const currentListener = getCookie(AUTH_LISTENER_NAME) || null

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
    if(process.env.NEXT_PUBLIC_CLARITY_ID) Clarity.init(process.env.NEXT_PUBLIC_CLARITY_ID)
  }, [])

  // PrimeReact ES locale setup
  useEffect(() => {
    addLocale('es', {
      firstDayOfWeek: 1,
      dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      today: 'Hoy',
      clear: 'Limpiar'
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
