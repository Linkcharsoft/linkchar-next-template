'use client'
import { SessionProvider } from 'next-auth/react'
import { PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const PrivdersContainer = ({ children }: Props) => {
  return (
    <PrimeReactProvider value={{ pt: Tailwind }}>
      <SessionProvider>{children}</SessionProvider>
    </PrimeReactProvider>
  )
}

export default PrivdersContainer
