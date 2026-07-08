import './AuthLayout.sass'
import Image from 'next/image'
import Logo from '@/assets/images/logo.svg'
import LoadingModal from '@/components/modals/LoadingModal/LoadingModal'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const AuthLayout = ({ children }: Props) => {
  return (
    <div className="AuthLayout__Container">
      <section className="AuthLayout__Form">
        { children }
        <LoadingModal/>
      </section>

      <aside className="AuthLayout__Aside" aria-hidden="true">
        <Image
          src={Logo}
          width={256}
          height={256}
          alt=""
          className="AuthLayout__Logo"
          priority
          fetchPriority="high"
        />
      </aside>
    </div>
  )
}

export default AuthLayout
