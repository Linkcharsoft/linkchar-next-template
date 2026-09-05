'use client'
import './ErrorPage.sass'
import { captureException } from '@sentry/nextjs'
import Image from 'next/image'
import { useEffect } from 'react'
import Logo from '@/assets/images/logo.svg'
import CustomButton from '@/components/CustomButton/CustomButton'
import Waves from '@/components/Waves/Waves'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

const ErrorPage = ({ error, reset }: Props) => {
  useEffect(() => {
    // Segment error boundaries swallow the error — without this Sentry never sees it.
    captureException(error)
  }, [error])

  return (
    <main id='main' className='ErrorPage'>
      <header></header>

      <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
        <Image
          src={Logo}
          alt='Logo'
          title='Logo'
          className="ErrorPage__Logo"
          priority
          fetchPriority='high'
        />
        <h1 className='text-bold-32 md:text-bold-56'>Something went wrong</h1>
        <p className='text-regular-16 md:text-regular-18'>We&apos;re sorry, an unexpected error has occurred. Our team has been notified</p>
        {error.digest && (
          <p className='text-regular-16 opacity-70'>Reference: {error.digest}</p>
        )}
        <div className='flex flex-wrap items-center justify-center gap-4'>
          <CustomButton onClick={reset}>
            Try again
          </CustomButton>
          <CustomButton
            variant='white'
            href='/'
          >
            Back to Home
          </CustomButton>
        </div>
      </div>

      <Waves/>
    </main>
  )
}

export default ErrorPage
