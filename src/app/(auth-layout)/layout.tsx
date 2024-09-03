'use client'
import { useEffect } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import useAuthContext from '@/hooks/useAuthContext'
import LoadingModal from '@/components/modals/LoadingModal'
import Logo from '@/assets/images/logo.svg'


interface Props {
  children: React.ReactNode
}


const AuthLayout = ({ children }: Props) => {
  const { token } = useAuthContext()
  const router = useRouter()
  const pathname = usePathname()


  useEffect(() => {
    if(
      token &&
      pathname !== '/change-password' &&
      pathname !== '/complete-profile' &&
      !pathname.includes('/change-password/confirm/')
    ) {
      router.replace('/')
    }
  }, [token])


  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <section className="relative flex w-[45%] items-center justify-center bg-white">
        { children }
        <LoadingModal />
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
