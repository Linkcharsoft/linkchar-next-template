import { useContext } from 'react'
import { AppContext, AppContextType } from '@/contexts/AppContext'

const useAppContext = () => {
  return useContext(AppContext) as AppContextType
}

export default useAppContext