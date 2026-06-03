import LandingLayout from '@/layouts/LandingLayout/LandingLayout'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => <LandingLayout>{ children }</LandingLayout>

export default Layout
