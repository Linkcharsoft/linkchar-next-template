'use client'
import Clarity from '@microsoft/clarity'
import { domAnimation, LazyMotion } from 'framer-motion'
import { usePathname, useRouter } from 'next/navigation'
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

const getCookie = (name: string): string | null => {
  const nameLenPlus = (name.length + 1)
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .filter(cookie => cookie.substring(0, nameLenPlus) === `${name}=`)
    .map(cookie => decodeURIComponent(cookie.substring(nameLenPlus)))[0] || null
}

const ProvidersContainer = ({ token, user, children }: Props) => {
  const { setToken, setUser } = useUserStore()
  const authListener = useRef<string | null>(getCookie(AUTH_LISTENER_NAME))
  const router = useRouter()
  const pathname = usePathname()


  // User data setup
  useEffect(() => {
    if(token) setToken(token)
    if(user) setUser(user)
  }, [token, user])

  // Auth cookie listener
  useEffect(() => {
    if (authListener.current === null) {
      authListener.current = getCookie(AUTH_LISTENER_NAME)
    }

    const currentListener = getCookie(AUTH_LISTENER_NAME)

    if (currentListener !== authListener.current) {
      authListener.current = currentListener

      router.refresh()
    }
  }, [pathname])

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
