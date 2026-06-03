import AuthHydrator from '@/providers/AuthHydrator'
import { getAccessToken, getServerUser } from '@/utils/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

// Authenticated auth routes: fetch + hydrate the session (makes these routes dynamic).
const Layout = async ({ children }: Props) => {
  const token = await getAccessToken()
  const user = await getServerUser()

  return (
    <>
      <AuthHydrator token={token} user={user} />
      { children }
    </>
  )
}

export default Layout
