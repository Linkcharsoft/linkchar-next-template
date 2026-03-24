'use client'
import { useFormik } from 'formik'
import { AnimatePresence, m } from 'framer-motion'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { emailConfirmation, resendEmailConfirmation } from '@/api/auth'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton/CustomButton'
import InputContainer from '@/components/inputs/InputContainer/InputContainer'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePersistentTimer from '@/hooks/usePersistentTimer'
import usePressKey from '@/hooks/usePressKey'
import useModalStore from '@/stores/modalStore'


type Props = {
  token: string
}

type SignupConfirmationFormikType = {
  email: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const SignupConfirmationPage = ({ token }: Props) => {
  const {
    openModal,
    closeModal,
    setNotification
  } = useModalStore()
  const isClient = useIsClient()
  const [showEmails, setShowEmails] = useState<boolean>(false)
  const [tokenStatus, setTokenStatus] = useState<TokenStatusType>('loading')
  const {
    timer,
    startTimer,
    timerIsRunning
  } = usePersistentTimer({
    storageKey: 'confirmation-resend-timer',
    time: 0
  })


  usePressKey('Enter', () => {
    if(tokenStatus === 'invalid') {
      invalidTokenFormik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    openModal('loadingModal', {
      title: 'Verifying link',
      content: 'Please wait...'
    })

    const verifyToken = async () => {
      const { ok } = await emailConfirmation({ key: token })

      if (ok) {
        setTokenStatus('valid')
      } else {
        setTokenStatus('invalid')
      }

      closeModal('loadingModal')
    }

    verifyToken()
  }, [])


  const invalidTokenFormik = useFormik<SignupConfirmationFormikType>({
    initialValues: {
      email: ''
    },
    validateOnChange: false,
    validationSchema: Yup.object({
      email: Yup.string().email(AUTH_INPUT_ERRORS['invalid-email']).required(AUTH_INPUT_ERRORS.required)
    }),
    onSubmit: async ({ email }) => {
      openModal('loadingModal', {
        title: 'Resending email',
        content: 'Please wait...'
      })

      try {
        const { ok } = await resendEmailConfirmation({ email })

        if (ok) {
          setNotification({
            severity: 'success',
            summary: 'Email sent! Please check your inbox',
            life: 3000
          })

          setShowEmails(true)
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
  })


  if (!isClient || tokenStatus === 'loading') return null

  return (
    <main className="AuthLayout">
      <form
        className="AuthLayout__Section"
        onSubmit={e => {
          e.preventDefault()
          if(tokenStatus === 'invalid') {
            invalidTokenFormik.handleSubmit()
          }
        }}
      >
        <h1 className="AuthLayout__Title">
          Sign up: Confirmation
        </h1>

        {(tokenStatus === 'invalid') && (
          <>
            <i className="pi pi-exclamation-triangle text-center text-48 text-orange-600"/>

            <div className="flex flex-col gap-6">
              <p className="text-regular-16 text-center text-surface-800">
                The link you&apos;ve used is no longer available, please try entering your email again.
              </p>

              <AnimatePresence>
                {showEmails && (
                  <m.div
                    className="flex items-center justify-center gap-8"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                  >
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
                  </m.div>
                )}
              </AnimatePresence>

              <InputContainer
                label='Email'
                htmlFor='email'
                error={invalidTokenFormik.errors.email}
              >
                <InputText
                  name="email"
                  id="email"
                  inputMode="email"
                  placeholder="Type your email"
                  value={invalidTokenFormik.values.email}
                  onChange={invalidTokenFormik.handleChange}
                  invalid={Boolean(invalidTokenFormik.errors.email)}
                  autoComplete="email"
                  keyfilter='email'
                  disabled={invalidTokenFormik.isSubmitting}
                  aria-disabled={invalidTokenFormik.isSubmitting}
                />
              </InputContainer>
            </div>

            <CustomButton
              className="w-full"
              type="submit"
              disabled={invalidTokenFormik.isSubmitting || timerIsRunning}
              aria-disabled={invalidTokenFormik.isSubmitting || timerIsRunning}
            >
              {timerIsRunning ? `Wait ${timer}s to resend` : 'Resend email'}
            </CustomButton>
          </>
        )}

        {(tokenStatus === 'valid') && (
          <>
            <i className="pi pi-check-circle text-center text-48 text-green-600"/>

            <p className="text-regular-16 text-center text-surface-800">
              Account successfully verified!
            </p>

            <CustomButton
              className="w-full"
              href='/login'
              replace
              type='button'
            >
              Go to log in
            </CustomButton>
          </>
        )}
      </form>
    </main>
  )
}

export default SignupConfirmationPage
