import AuthLayout from '@/layouts/AuthLayout/AuthLayout'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false }
}

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => <AuthLayout>{ children }</AuthLayout>

export default Layout
