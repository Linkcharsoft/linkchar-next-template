'use client'
import * as Sentry from '@sentry/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Logo from '@/assets/images/logo.svg'
import Waves from '@/components/Waves'

const IS_TEST = process.env.NEXT_PUBLIC_APP_ENV === 'staging' || process.env.NEXT_PUBLIC_APP_ENV === 'development'

const GlobalErrorPage = ({
  error
  // reset
}: {
  error: Error & { digest?: string }
  // reset: () => void;
}) => {
  const [eventId, setEventId] = useState<string | undefined>()

  useEffect(() => {
    const id = Sentry.captureException(error, {
      level: 'fatal'
    })

    setEventId(id)
  }, [error])

  return (
    <div className='NotFoundPage'>
      <header></header>

      <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
        <Image
          src={Logo}
          alt='Logo'
          title='Logo'
          className="NotFoundPage__Logo"
          priority
        />
        <h1 className='text-bold-32 md:text-bold-48'>
          <span className='hidden md:inline'>⚠️</span> Something went wrong <span className='hidden md:inline'>⚠️</span>
        </h1>
        <div className='flex flex-col gap-2'>
          <p className='text-regular-16 md:text-regular-18'>We&apos;re sorry, a critical system error has occurred</p>
          <p className='text-regular-16 md:text-regular-18'>Our team has been notified</p>
        </div>

        {/* <button
          className='NotFoundPage__Link'
          onClick={reset}
        >
          Try again
        </button> */}

        <Link
          className='NotFoundPage__Link'
          href="/"
        >
          Back to Home
        </Link>

        {(IS_TEST && eventId) && (
          <>
            <p className='text-regular-16 md:text-regular-18'>If you have any relevant information that could help us replicate the issue:</p>

            <button
              className='NotFoundPage__Link'
              onClick={() => {
                Sentry.showReportDialog({ eventId })
              }}
            >
              Send feedback
            </button>
          </>
        )}
      </div>

      <Waves/>
    </div>
  )
}

export default GlobalErrorPage