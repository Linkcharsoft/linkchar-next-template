import AuthLayout from '@/layouts/AuthLayout/AuthLayout'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => <AuthLayout>{ children }</AuthLayout>

export default Layout
