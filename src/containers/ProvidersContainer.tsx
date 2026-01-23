'use client'
import Clarity from '@microsoft/clarity'
import { domAnimation, LazyMotion } from 'framer-motion'
import { addLocale, PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { useEffect } from 'react'
import useUserStore from '@/stores/userStore'
import { getServerUser } from '@/utils/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const ProvidersContainer = ({ children }: Props) => {
  const { setUser } = useUserStore()


  useEffect(() => {
    (async () => {
      const session = await getServerUser()

      if(session) setUser(session)
    })()
  }, [])

  useEffect(() => {
    if(process.env.NEXT_PUBLIC_CLARITY_ID) Clarity.init(process.env.NEXT_PUBLIC_CLARITY_ID)
  }, [])

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
    </PrimeReactProvider>
  )
}

export default ProvidersContainer
