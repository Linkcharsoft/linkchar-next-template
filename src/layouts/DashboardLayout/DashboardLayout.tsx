import './DashboardLayout.sass'
import LoadingModal from '@/components/modals/LoadingModal/LoadingModal'
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
