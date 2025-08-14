'use client'
import { PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { ReactNode, useEffect } from 'react'
import useUserStore from '@/stores/userStore'
import { getServerUser } from '@/utils/auth'

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

  return (
    <PrimeReactProvider value={{ pt: Tailwind }}>
      { children }
    </PrimeReactProvider>
  )
}

export default ProvidersContainer
