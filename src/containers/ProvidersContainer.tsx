'use client'
import Clarity from '@microsoft/clarity'
import { PrimeReactProvider } from 'primereact/api'
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


  return (
    <PrimeReactProvider value={{ pt: Tailwind }}>
      { children }
    </PrimeReactProvider>
  )
}

export default ProvidersContainer
