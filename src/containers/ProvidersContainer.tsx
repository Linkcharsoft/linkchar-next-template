'use client'
import { PrimeReactProvider } from 'primereact/api'
import Tailwind from 'primereact/passthrough/tailwind'
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const PrivdersContainer = ({ children }: Props) => {
  return (
    <PrimeReactProvider value={{ pt: Tailwind }}>
      { children }
    </PrimeReactProvider>
  )
}

export default PrivdersContainer
