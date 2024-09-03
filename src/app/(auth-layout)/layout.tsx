'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import LoadingModal from '@/components/modals/LoadingModal'
import ToastMessages from '@/components/modals/ToastMessages'
import Logo from '@/assets/images/logo.svg'
import { useSession } from 'next-auth/react'

interface Props {
  children: React.ReactNode
}

const AuthLayout = ({ children }: Props) => {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (
      status === 'authenticated' &&
      pathname !== '/change-password' &&
      pathname !== '/complete-profile' &&
      !pathname.includes('/change-password/confirm/')
    ) {
      router.replace('/')
    }
  }, [status])

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <section className="relative flex w-[45%] items-center justify-center bg-white">
        {children}
        <LoadingModal />
        <ToastMessages />
      </section>

      <section className="h-full w-[55%] bg-black flex justify-center items-center">
        <Image src={Logo} width={256} height={256} alt="Logo" className="AuthLayout__Logo" priority />
      </section>
    </main>
  )
}

export default AuthLayout
