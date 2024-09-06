'use client'
import { createContext, ReactNode, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { getMyUser } from '@/api/users'
import useSWR from 'swr'
import type { User } from '@/types/users'


export interface UserContextType {
  user: User
  mutateUser: () => void

  token: string
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated'
}

export const UserContext = createContext<UserContextType | null>(null)

interface UserContextProviderType {
  children: ReactNode
}

const UserContextProvider = ({ children }: UserContextProviderType) => {
  const { data: session, status } = useSession()

  const {
    data: user,
    mutate: mutateUser
  } = useSWR(
    session?.user?.accessToken ? `api-users-get-${session?.user?.accessToken}` : null,
    () => getMyUser(session?.user?.accessToken as string)
  )

  const userData: User = useMemo(() => user?.data as User, [user])

  const token = session?.user?.accessToken as string

  const sessionStatus = status


  const value = {
    user: userData,
    mutateUser,

    token,
    sessionStatus
  }


  return (
    <UserContext.Provider value={value}>
      { children }
    </UserContext.Provider>
  )
}

export default UserContextProvider