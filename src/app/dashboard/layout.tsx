import DashboardLayout from '@/layouts/DashboardLayout/DashboardLayout'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const Layout = ({ children }: Props) => <DashboardLayout>{ children }</DashboardLayout>

export default Layout
