'use client'
import Link from 'next/link'
import { useIsClient } from 'usehooks-ts'
import { resendEmailConfirmation } from '@/api/auth'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton'
import usePersistentTimer from '@/hooks/usePersistentTimer'
import { useAppStore } from '@/stores/appStore'


type Props = {
  email: string
}


const EmailValidationPage = ({ email }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
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
    showLoadingModal({
      title: 'Resending email',
      message: 'Please wait...'
    })

    try {
      const { ok } = await resendEmailConfirmation({ email })

      if (ok) {
        setToastMessage({
          severity: 'success',
          summary: 'Email sent! Please check your inbox',
          life: 3000
        })

        startTimer()
      } else {
        setToastMessage({
          severity: 'error',
          summary: 'Error sending email, please try again later',
          life: 5000
        })
      }
    } catch (error) {
      setToastMessage({
        severity: 'error',
        summary: 'Error sending email, please try again later',
        life: 5000
      })
      // ! Sentry
      console.error(`Error: ${error.message}`)
    } finally {
      hideLoadingModal()
    }
  }


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <i className="pi pi-envelope text-center text-48 text-blue-600" />

        <h1 className="AuthLayout__Title">
          Validate your email!
        </h1>

        <p className="text-center text-base font-normal text-surface-800">
          We sent you an email to <span className="font-semibold text-surface-900" style={{ overflowWrap: 'anywhere' }}>{email}</span> with a link to validate your account
        </p>


        <div className="flex items-center justify-center gap-8">
          <Link
            className='hover:opacity-75'
            href='https://outlook.com/'
            target='_blank'
          >
            <OutlookIcon/>
          </Link>

          <Link
            className='hover:opacity-75'
            href='https://gmail.com/'
            target='_blank'
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
            <p className="font-normal text-surface-800">
              Didn&apos;t receive anything?
            </p>

            <CustomButton
              variant='transparent'
              className='w-full !font-semibold'
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
