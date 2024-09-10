'use client'
import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsClient } from 'usehooks-ts'
import { Button } from 'primereact/button'
import { resendEmailConfirmation } from '@/api/users'
import useAppContext from '@/hooks/useAppContext'


type Props = {
  email: string
}


const EmailValidationPage = ({ email }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal
  } = useAppContext()
  const router = useRouter()
  const isClient = useIsClient()
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)


  const DECODED_EMAIL = useMemo(() => decodeURIComponent(email), [email])


  const handleLoginRedirect = () => router.replace('/login')

  const handleResendEmail = async (email: string) => {
    showLoadingModal({})
    setButtonDisabled(true)

    setTimeout(() => {
      setButtonDisabled(false)
    }, 15000) // 15 seconds interval. Preventing spam

    try {
      const { ok } = await resendEmailConfirmation({ email })
      if (!ok) {
        // TODO: error modal
        setTimeout(() => {
          setButtonDisabled(false)
        }, 30000)
      } else {
        // TODO: success modal
        setTimeout(() => {
          setButtonDisabled(false)
        }, 30000)
      }
    } catch (error) {
      console.error(`Error sending email: ${error}`)
    } finally {
      hideLoadingModal()
    }
  }


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Validate your email!
        </h1>

        <div className="mx-auto flex w-[243px] flex-col gap-4">
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            We sent you an email with a link to validate your account.
          </p>
        </div>

        <div className="flex w-full justify-center">
          <Button
            className="w-full"
            onClick={handleLoginRedirect}
          >
            Go to log in
          </Button>
        </div>

        <div className="flex w-full justify-center">
          <Button
            onClick={() => handleResendEmail(DECODED_EMAIL)}
            link
            className="w-[80%]"
            disabled={buttonDisabled}
          >
            <p className="font-normal text-surface-800">
              Didn&apos;t receive anything?
              <span className="font-bold text-surface-800">
                {' '}
                Click here to send again.
              </span>
            </p>
          </Button>
        </div>
      </section>
    </main>
  )
}

export default EmailValidationPage
