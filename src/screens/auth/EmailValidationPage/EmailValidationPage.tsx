'use client'
import './EmailValidationPage.sass'
import Link from 'next/link'
import { useIsClient } from 'usehooks-ts'
import { resendEmailConfirmation } from '@/api/auth'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton/CustomButton'
import usePersistentTimer from '@/hooks/usePersistentTimer'
import useModalStore from '@/stores/modalStore'


type Props = {
  email: string
}


const EmailValidationPage = ({ email }: Props) => {
  const openModal = useModalStore((s) => s.openModal)
  const closeModal = useModalStore((s) => s.closeModal)
  const setNotification = useModalStore((s) => s.setNotification)
  const isClient = useIsClient()
  const {
    timer,
    startTimer,
    timerIsRunning
  } = usePersistentTimer({
    storageKey: 'validation-resend-timer',
    time: 30,
    initialTime: 5
  })


  const handleResendEmail = async () => {
    openModal('loadingModal', {
      title: 'Resending email',
      content: 'Please wait...'
    })

    try {
      const { ok } = await resendEmailConfirmation({ email })

      if (ok) {
        setNotification({
          severity: 'success',
          summary: 'Email sent! Please check your inbox'
        })

        startTimer()
      } else {
        setNotification({
          severity: 'error',
          summary: 'Error sending email, please try again later',
          life: 5000
        })
      }
    } catch (error) {
      setNotification({
        severity: 'error',
        summary: 'Error sending email, please try again later',
        life: 5000
      })
      // ! Sentry
      const message = error instanceof Error ? error.message : error
      console.error(`Error: ${message}`)
    } finally {
      closeModal('loadingModal')
    }
  }


  if (!isClient) return null

  return (
    <main id="main" className="AuthLayout">
      <section className="AuthLayout__Section">
        <i className="pi pi-envelope text-regular-48 text-center text-blue-600" aria-hidden="true" />

        <h1 className="AuthLayout__Title">
          Validate your email!
        </h1>

        <p className="text-regular-16 text-center text-surface-800">
          We sent you an email to <span className="text-semibold-16 text-surface-900" style={{ overflowWrap: 'anywhere' }}>{email}</span> with a link to validate your account
        </p>


        <div className="flex items-center justify-center gap-8">
          <Link
            className='hover:opacity-75'
            href='https://outlook.com/'
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Open Outlook'
          >
            <OutlookIcon/>
          </Link>

          <Link
            className='hover:opacity-75'
            href='https://gmail.com/'
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Open Gmail'
          >
            <GmailIcon/>
          </Link>
        </div>

        <div className="flex w-full flex-col gap-6">
          <CustomButton
            href='/login'
            replace
            className="w-full"
          >
            Go to log in
          </CustomButton>

          <div className="flex w-full flex-col items-center justify-center gap-2">
            <p className="text-regular-16 text-surface-800">
              Didn&apos;t receive anything?
            </p>

            <CustomButton
              variant='transparent'
              className='!text-semibold-16 w-full'
              onClick={handleResendEmail}
              disabled={timerIsRunning}
              type='submit'
            >
              {timerIsRunning ? `Wait ${timer}s to resend` : 'Click here to send again'}
            </CustomButton>
          </div>
        </div>
      </section>
    </main>
  )
}

export default EmailValidationPage
