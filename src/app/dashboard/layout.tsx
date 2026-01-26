import LoadingModal from '@/components/modals/LoadingModal'
import type { ReactNode } from 'react'


interface Props {
  children: ReactNode
}


const DashboardLayout = ({ children }: Props) => {
  return (
    <>
      { children }
      <LoadingModal/>
    </>
  )
}

export default DashboardLayout
