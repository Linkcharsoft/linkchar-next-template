import './GeneralLayout.sass'
import ProvidersContainer from '@/providers/ProvidersContainer'
import { getAccessToken, getServerUser } from '@/utils/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const GeneralLayout = async ({ children }: Props) => {
  const token = await getAccessToken()
  const user = await getServerUser()

  return (
    <ProvidersContainer token={token} user={user}>
      { children }
    </ProvidersContainer>
  )
}


export default GeneralLayout
