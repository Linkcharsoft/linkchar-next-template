'use client'
import { createContext, ReactNode, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { getMyUser } from '@/api/users'
import useSWR from 'swr'
import type { User } from '@/types/users'


export interface UserContextType {
  user: User
  mutateUser: () => void
}

export const UserContext = createContext<UserContextType | null>(null)

interface UserContextProviderType {
  children: ReactNode
}

const UserContextProvider = ({ children }: UserContextProviderType) => {
  const { data: session } = useSession()

  const {
    data: user,
    mutate: mutateUser
  } = useSWR(
    session?.user?.accessToken ? 'api/users/me/' : null,
    () => getMyUser(session?.user?.accessToken as string)
  )

  const userData: User = useMemo(() => user?.data as User, [user])
  // const isAdmin = useMemo(() => userData?.is_staff, [userData])


  const value = {
    user: userData,
    mutateUser
  }


  return (
    <UserContext.Provider value={value}>
      { children }
    </UserContext.Provider>
  )
}

export default UserContextProvider