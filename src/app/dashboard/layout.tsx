import DashboardLayout from '@/layouts/DashboardLayout/DashboardLayout'
import AuthHydrator from '@/providers/AuthHydrator'
import { getAccessToken, getServerUser } from '@/utils/auth'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false }
}

interface Props {
  children: ReactNode
}

const Layout = async ({ children }: Props) => {
  const token = await getAccessToken()
  const user = await getServerUser()

  return (
    <>
      <AuthHydrator token={token} user={user} />
      <DashboardLayout>{ children }</DashboardLayout>
    </>
  )
}

export default Layout
