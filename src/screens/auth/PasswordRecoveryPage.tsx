'use client'
import { useFormik } from 'formik'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'
import { useEffect, useState } from 'react'
import { useIsClient, useSessionStorage } from 'usehooks-ts'
import * as Yup from 'yup'
import { passwordRecoveryChange } from '@/api/users'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'


type PasswordRecoveryFormikType = {
  email: string
}


const PasswordRecoveryPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const isClient = useIsClient()
  const [ showEmails, setShowEmails ] = useState<boolean>(false)
  const [ timer, setTimer ] = useSessionStorage<number>('recovery-resend-timer', 0)


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


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


  const formik = useFormik<PasswordRecoveryFormikType>({
    initialValues: {
      email: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Enter a valid email address').required('Required')
    }),
    validateOnChange: false,
    onSubmit: async ({ email }) => {
      showLoadingModal({
        title: 'Sending email',
        message: 'Plase wait...'
      })

      try {
        const { ok } = await passwordRecoveryChange({
          request_type: 'reset',
          email: email
        })

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
        console.error(`Error sending email: ${error}`)
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
        onSubmit={(e) => {
          e.preventDefault()
          formik.handleSubmit()
        }}
      >
        <h1 className="AuthLayout__Title">
          Enter your email
        </h1>

        <div className="mx-auto flex w-full flex-col gap-4">
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            We will send you an email with a link to change your password
          </p>
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            Make sure to check the spam folder
          </p>
        </div>

        <AnimatePresence>
          {showEmails && (
            <motion.div
              className="flex justify-center items-center gap-8"
              initial={{ height: 0,opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
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
            />
            <InputError message={formik.errors.email} />
          </div>
        </div>

        <div className="flex w-full justify-center">
          <CustomButton
            className="w-full"
            type="submit"
            disabled={formik.isSubmitting || timer > 0}
          >
            {timer > 0 ? `Wait ${timer}s to resend` : 'Send email'}
          </CustomButton>
        </div>

        <CustomButton
          variant='transparent'
          href='/login'
          className='w-full'
          type='button'
        >
          <span className='text-surface-800'>
            Go back to <span className="font-bold">Log in</span>
          </span>
        </CustomButton>
      </form>
    </main>
  )
}

export default PasswordRecoveryPage
