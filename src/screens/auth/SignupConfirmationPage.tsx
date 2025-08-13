'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'
import { useIsClient, useSessionStorage } from 'usehooks-ts'
import * as Yup from 'yup'
import { emailConfirmation, resendEmailConfirmation } from '@/api/users'
import CustomButton from '@/components/CustomButton'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import Loader from '@/components/Loader'
import { useAppStore } from '@/stores/appStore'
import usePressKey from '@/hooks/usePressKey'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import GmailIcon from '@/assets/icons/GmailIcon'


type Props = {
  token: string
}

type SignupConfirmationFormikType = {
  email: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const SignupConfirmationPage = ({ token } : Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const router = useRouter()
  const isClient = useIsClient()
  const [ showEmails, setShowEmails ] = useState<boolean>(false)
  const [ timer, setTimer ] = useSessionStorage<number>('confirmation-resend-timer', 0)

  const [ tokenStatus, setTokenStatus ] = useState<TokenStatusType>('invalid')
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)


  usePressKey('Enter', () => {
    if(tokenStatus === 'invalid') {
      formik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    showLoadingModal({
      title: 'Verifying link',
      message: 'Please wait...'
    })

    const verifyToken = async () => {
      const decodedToken = decodeURIComponent(token)

      const { ok } = await emailConfirmation({ key: decodedToken })

      if (ok) {
        setTokenStatus('valid')
      } else {
        setTokenStatus('invalid')
      }

      hideLoadingModal()
    }

    verifyToken()
  }, [])

  // Redirect if there isnt token
  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token])

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


  const formik = useFormik<SignupConfirmationFormikType>({
    initialValues: {
      email: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Enter a valid email address').required('Required')
    }),
    validateOnChange: false,
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


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <form
        className="AuthLayout__Section"
        onSubmit={e => {
          e.preventDefault()
          if(tokenStatus === 'invalid') {
            formik.handleSubmit()
          }
        }}
      >
        <h1 className="AuthLayout__Title">
          Sign up: Confirmation
        </h1>

        {tokenStatus === 'loading' && (
          <div className="mx-auto">
            <Loader/>
          </div>
        )}

        {tokenStatus === 'invalid' && (
          <>
            <div className="flex w-full justify-center items-center">
              <i className="pi pi-exclamation-triangle text-yellow-500 text-[48px] text-center"/>
            </div>

            <div className="mx-auto flex flex-col gap-4">
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
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <InputText
                    name="email"
                    id="email"
                    inputMode="email"
                    placeholder="Type your email"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    invalid={Boolean(formik.errors.email)}
                    autoComplete="email"
                    keyfilter='email'
                    disabled={formik.isSubmitting}
                    aria-disabled={formik.isSubmitting}
                  />
                  <InputError message={formik.errors.email as string} />
                </div>
              </div>

              <div className="flex w-full justify-center">
                <CustomButton
                  className="w-full mt-3"
                  type="submit"
                  disabled={formik.isSubmitting || timer > 0}
                  aria-disabled={formik.isSubmitting || timer > 0}
                >
                  {timer > 0 ? `Wait ${timer}s to resend` : 'Resend email'}
                </CustomButton>
              </div>
            </div>
          </>
        )}

        {(tokenStatus === 'valid') && (
          <>
            <div className="flex w-full justify-center items-center">
              <i className="pi pi-check-circle text-green-600 text-[48px] text-center"/>
            </div>

            <div className="mx-auto flex w-[243px] flex-col gap-4">
              <p className="text-center text-base font-normal text-surface-800">
                Account successfully verified!
              </p>
            </div>

            <div className="flex w-full justify-center">
              <CustomButton
                className="w-full"
                href='/login'
                replace
                type='button'
              >
                Go to log in
              </CustomButton>
            </div>
          </>
        )}
      </form>
    </main>
  )
}

export default SignupConfirmationPage
