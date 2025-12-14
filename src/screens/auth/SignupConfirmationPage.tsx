'use client'
import { useFormik } from 'formik'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'
import { useIsClient, useSessionStorage } from 'usehooks-ts'
import * as Yup from 'yup'
import { emailConfirmation, resendEmailConfirmation } from '@/api/users'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton'
import InputContainer from '@/components/InputContainer'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'


type Props = {
  token: string
}

type SignupConfirmationFormikType = {
  email: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const SignupConfirmationPage = ({ token }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const isClient = useIsClient()
  const [showEmails, setShowEmails] = useState<boolean>(false)
  const [timer, setTimer] = useSessionStorage<number>('confirmation-resend-timer', 0)
  const [tokenStatus, setTokenStatus] = useState<TokenStatusType>('loading')


  usePressKey('Enter', () => {
    if(tokenStatus === 'invalid') {
      invalidTokenFormik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    showLoadingModal({
      title: 'Verifying link',
      message: 'Please wait...'
    })

    const verifyToken = async () => {
      const { ok } = await emailConfirmation({ key: token })

      if (ok) {
        setTokenStatus('valid')
      } else {
        setTokenStatus('invalid')
      }

      hideLoadingModal()
    }

    verifyToken()
  }, [])

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


  const invalidTokenFormik = useFormik<SignupConfirmationFormikType>({
    initialValues: {
      email: ''
    },
    validateOnChange: false,
    validationSchema: Yup.object({
      email: Yup.string().email(AUTH_INPUT_ERRORS['invalid-email']).required(AUTH_INPUT_ERRORS.required)
    }),
    onSubmit: async ({ email }) => {
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

          setShowEmails(true)
          setTimer(30)
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
            <i className="pi pi-exclamation-triangle text-yellow-500 text-[48px] text-center"/>

            <div className="flex flex-col gap-6">
              <p className="text-center text-base font-normal text-surface-800">
                The link you&apos;ve used is no longer available, please try entering your email again.
              </p>

              <AnimatePresence>
                {showEmails && (
                  <motion.div
                    className="flex justify-center items-center gap-8"
                    initial={{ height: 0,opacity: 0 }}
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
                  </motion.div>
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
              disabled={invalidTokenFormik.isSubmitting || timer > 0}
              aria-disabled={invalidTokenFormik.isSubmitting || timer > 0}
            >
              {timer > 0 ? `Wait ${timer}s to resend` : 'Resend email'}
            </CustomButton>
          </>
        )}

        {(tokenStatus === 'valid') && (
          <>
            <i className="pi pi-check-circle text-green-600 text-[48px] text-center"/>

            <p className="text-center text-base font-normal text-surface-800">
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
