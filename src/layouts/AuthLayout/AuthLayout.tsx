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
    <div className="flex h-screen w-screen overflow-hidden">
      <section className="relative flex w-[45%] items-center justify-center bg-white">
        { children }
        <LoadingModal/>
      </section>

      <aside className="flex h-full w-[55%] items-center justify-center bg-black" aria-hidden="true">
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
