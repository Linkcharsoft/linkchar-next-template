import './GeneralLayout.sass'
import ProvidersContainer from '@/providers/ProvidersContainer'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const GeneralLayout = ({ children }: Props) => (
  <ProvidersContainer>
    { children }
  </ProvidersContainer>
)


export default GeneralLayout
