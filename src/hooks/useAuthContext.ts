import { useContext } from 'react'
import { AuthContext, AuthContextType } from '@/contexts/AuthContext'

const useAuthContext = () => {
  return useContext(AuthContext) as AuthContextType
}

export default useAuthContext