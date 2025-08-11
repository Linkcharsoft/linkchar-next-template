'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { useIsClient, useSessionStorage } from 'usehooks-ts'
import { resendEmailConfirmation } from '@/api/users'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton'
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
  const router = useRouter()
  const isClient = useIsClient()
  const [ timer, setTimer ] = useSessionStorage<number>('emailResendTimer', 0)


  // Redirect if there isnt email
  useEffect(() => {
    if (!email) router.replace('/login')
  }, [email])

  // Timer logic
  useEffect(() => {
    if (timer <= 0) return

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [setTimer, timer > 0])


  const DECODED_EMAIL = useMemo(() => decodeURIComponent(email), [email])


  const handleResendEmail = async (email: string) => {
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
          life: 10000
        })

        setTimer(30)
      } else {
        setToastMessage({
          severity: 'error',
          summary: 'Error sending email, please try again later',
          life: 15000
        })
      }
    } catch (error) {
      setToastMessage({
        severity: 'error',
        summary: 'Error sending email, please try again later',
        life: 15000
      })
      // ! Sentry
    } finally {
      hideLoadingModal()
    }
  }


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <i className="pi pi-envelope text-blue-600 text-[48px] text-center" />

        <h1 className="mx-auto text-center text-3xl font-bold leading-none text-surface-900">
          Validate your email!
        </h1>

        <div className="mx-auto flex flex-col gap-4">
          <p className="text-center text-base font-normal text-surface-800">
            We sent you an email to <span className="text-surface-900 font-semibold" style={{ overflowWrap: 'anywhere' }}>{DECODED_EMAIL}</span> with a link to validate your account.
          </p>
        </div>

        <div className="flex justify-center items-center gap-8">
          <Link
            className='hover:opacity-75'
            href='https://outlook.com'
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

        <div className="flex w-full justify-center">
          <CustomButton
            href={'/login'}
            replace
            className="w-full"
          >
            Go to log in
          </CustomButton>
        </div>

        <div className="w-full flex flex-col justify-center items-center gap-2">
          <p className="font-normal text-surface-800">
            Didn&apos;t receive anything?
          </p>

          <button
            onClick={() => handleResendEmail(DECODED_EMAIL)}
            className='font-semibold hover:opacity-75'
            disabled={timer > 0}
          >
            {timer > 0 ? `Wait ${timer}s to resend` : 'Click here to send again'}
          </button>
        </div>
      </section>
    </main>
  )
}

export default EmailValidationPage
