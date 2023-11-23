import { useContext } from 'react'
import { CoreContext } from '@/contexts/[Core]Context'

const useCoreContext = () => {
  return useContext(CoreContext)
}

export default useCoreContext