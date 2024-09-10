import { useContext } from 'react'
import { UserContext, UserContextType } from '@/contexts/UserContext'

const useAuthContext = () => {
  return useContext(UserContext) as UserContextType
}

export default useAuthContext