import './NotFoundPage.sass'
import Image from 'next/image'
import Logo from '@/assets/images/logo.svg'
import CustomButton from '@/components/CustomButton/CustomButton'
import Waves from '@/components/Waves/Waves'

const NotFoundPage = () => {
  return (
    <main id='main' className='NotFoundPage'>
      <header></header>

      <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
        <Image
          src={Logo}
          alt='Logo'
          title='Logo'
          className="NotFoundPage__Logo"
          priority
          fetchPriority='high'
        />
        <h1 className='text-bold-32 md:text-bold-56'>Page Not Found</h1>
        <p className='text-regular-16 md:text-regular-18'>We&apos;re sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved</p>
        <CustomButton
          href="/"
        >
          Back to Home
        </CustomButton>
      </div>

      <Waves/>
    </main>
  )
}

export default NotFoundPage