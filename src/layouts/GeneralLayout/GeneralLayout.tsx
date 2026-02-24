import './GeneralLayout.sass'
import ProvidersContainer from '@/providers/ProvidersContainer'
import { getAccessToken, getServerUser } from '@/utils/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const GeneralLayout = async ({ children }: Props) => {
  let token
  let user

  try {
    token = await getAccessToken()
    user = await getServerUser()
  } catch (error) {
    console.error(error)
  }

  return (
    <ProvidersContainer token={token} user={user}>
      { children }
    </ProvidersContainer>
  )
}


export default GeneralLayout