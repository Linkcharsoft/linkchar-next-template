import Image from 'next/image'
import { ReactNode } from 'react'
import Logo from '@/assets/images/logo.svg'
import LoadingModal from '@/components/modals/LoadingModal'
import ToastMessages from '@/components/modals/ToastMessages'


interface Props {
  children: ReactNode
}


const AuthLayout = ({ children }: Props) => {
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <section className="relative flex w-[45%] items-center justify-center bg-white">
        { children }
        <LoadingModal />
        <ToastMessages />
      </section>

      <section className="h-full w-[55%] bg-black flex justify-center items-center">
        <Image
          src={Logo}
          width={256}
          height={256}
          alt="Logo"
          className="AuthLayout__Logo"
          priority
        />
      </section>
    </main>
  )
}

export default AuthLayout
