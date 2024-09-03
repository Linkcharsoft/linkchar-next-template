'use client'
import { createContext, ReactNode, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocalStorage } from 'usehooks-ts'
import { getMyUser, logout } from '@/api/users'
import useSWR from 'swr'


type Profile = {
  id: number
  phone: string | null
  organization: string | null
  role: string | null
  other_role: string | null
  is_register_complete: boolean
  country: number | null
  created_at: string
  updated_at: string
  deleted: boolean
  deleted_at: string | null
}
type User = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  updated_at: string
  deleted: boolean
  deleted_at: string | null
  is_staff: boolean
  profile: Profile
}

export interface AuthContextType {
  token: string
  updateToken: (token: string) => void
  handleLogout: () => void

  user: User
  mutateUser: () => void
}


export const AuthContext = createContext<AuthContextType | null>(null)


interface AuthContextProviderType {
  children: ReactNode
}


const AuthContextProvider = ({ children }: AuthContextProviderType) => {
  const router = useRouter()
  const [ token, setToken ] = useLocalStorage('token', '')


  const updateToken = (token: string) => setToken(token)

  const handleLogout = async () => {
    const response = await logout(token)
    if (response.ok) {
      setToken('')
      localStorage.removeItem('token')
      router.push('/login')
    }
  }


  const {
    data: user,
    mutate: mutateUser
  } = useSWR(
    token ? 'api/users/me/' : null,
    () => getMyUser(token)
  )

  const userData: User = useMemo(() => user?.data as User, [user])
  // const isAdmin = useMemo(() => userData?.is_staff, [userData])


  const value = {
    token,
    updateToken,
    handleLogout,

    user: userData,
    mutateUser
  }


  return (
    <AuthContext.Provider value={value}>
      { children }
    </AuthContext.Provider>
  )
}

export default AuthContextProvider