'use client'
import './GlobalErrorPage.sass'
import { captureException, getClient, getFeedback } from '@sentry/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Logo from '@/assets/images/logo.svg'
import CustomButton from '@/components/CustomButton/CustomButton'
import Waves from '@/components/Waves/Waves'

// Support channel for the mailto fallback shown when feedback can't reach Sentry.
const SUPPORT_EMAIL_ADDRESS = 'support@linkchar.com'

// Probe the path the SDK transport actually uses (the first-party `tunnelRoute`, else
// the ingest host). A blocker aborts the request and the fetch rejects — our signal to
// fall back to mailto instead of opening a widget whose submission would fail anyway.
const isFeedbackTransportReachable = async (): Promise<boolean> => {
  const client = getClient()
  if (!client) return false

  const { tunnel } = client.getOptions()

  let url: string
  if (tunnel) {
    url = new URL(tunnel, window.location.origin).toString()
  } else {
    const dsn = client.getDsn()
    if (!dsn) return false
    const port = dsn.port ? `:${dsn.port}` : ''
    url = `${dsn.protocol}://${dsn.host}${port}/api/${dsn.projectId}/envelope/`
  }

  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

const GlobalErrorPage = ({
  error
  // reset
}: {
  error: Error & { digest?: string }
  // reset: () => void;
}) => {
  const [eventId, setEventId] = useState<string | undefined>()
  // undefined = still probing, true = widget usable, false = blocked → fallback
  const [feedbackReachable, setFeedbackReachable] = useState<boolean | undefined>()

  useEffect(() => {
    const id = captureException(error, {
      level: 'fatal'
    })

    setEventId(id)
  }, [error])

  useEffect(() => {
    let active = true

    isFeedbackTransportReachable().then((reachable) => {
      if (active) setFeedbackReachable(reachable)
    })

    return () => {
      active = false
    }
  }, [])

  // Bundled feedback widget — renders from the app bundle (unlike showReportDialog's
  // external script or feedbackIntegration's CDN modal, which blockers stop). Imported
  // on click so its UI lands in an on-demand chunk, not the global-error bundle.
  const openFeedbackWidget = async () => {
    let feedback = getFeedback()

    if (!feedback) {
      const client = getClient()
      if (!client) return

      const { feedbackSyncIntegration } = await import('@sentry/nextjs')

      client.addIntegration(feedbackSyncIntegration({
        autoInject: false,
        showBranding: false,
        colorScheme: 'system',
        enableScreenshot: false,
        tags: eventId ? { relatedEventId: eventId } : undefined
      }))

      feedback = getFeedback()
    }

    if (!feedback) return

    const form = await feedback.createForm()
    form.appendToDom()
    form.open()
  }

  const showFeedbackButton = eventId && feedbackReachable === true
  const showMailtoFallback = eventId && feedbackReachable === false

  const mailtoHref = `mailto:${SUPPORT_EMAIL_ADDRESS}?subject=${encodeURIComponent(
    `Critical error report${eventId ? ` (${eventId})` : ''}`
  )}`

  return (
    <main id='main' className='GlobalErrorPage'>
      <div></div>

      <div className="flex flex-col items-center justify-center gap-6 px-4 text-center">
        <Image
          src={Logo}
          alt='Logo'
          title='Logo'
          className="GlobalErrorPage__Logo"
          priority
          fetchPriority='high'
        />

        <h1 className='text-bold-32 md:text-bold-48'>
          <span className='hidden md:inline'>⚠️</span> Something went wrong <span className='hidden md:inline'>⚠️</span>
        </h1>

        <div className='flex flex-col gap-2'>
          <p className='text-regular-16 md:text-regular-18'>We&apos;re sorry, a critical system error has occurred</p>
          <p className='text-regular-16 md:text-regular-18'>Our team has been notified</p>
        </div>

        {/* <button
          className='GlobalErrorPage__Link'
          onClick={reset}
        >
          Try again
        </button> */}

        <Link
          className='GlobalErrorPage__Link'
          href="/"
        >
          Back to Home
        </Link>

        {showFeedbackButton && (
          <>
            <p className='text-regular-16 md:text-regular-18'>If you have any relevant information that could help us replicate the issue:</p>

            <CustomButton
              variant='transparent'
              className='GlobalErrorPage__Link'
              onClick={openFeedbackWidget}
            >
              Send feedback
            </CustomButton>
          </>
        )}

        {showMailtoFallback && (
          <>
            <p className='text-regular-16 md:text-regular-18'>If you have any relevant information that could help us replicate the issue, reach out to us:</p>

            <a
              className='GlobalErrorPage__Link'
              href={mailtoHref}
            >
              Contact support
            </a>
          </>
        )}
      </div>

      <Waves/>
    </main>
  )
}

export default GlobalErrorPage
