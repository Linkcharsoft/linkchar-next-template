'use client'
import './PasswordRecoveryPage.sass'
import { useFormik } from 'formik'
import { AnimatePresence, m } from 'framer-motion'
import Link from 'next/link'
import { InputText } from 'primereact/inputtext'
import { useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { passwordRecoveryChange } from '@/api/auth'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton/CustomButton'
import InputContainer from '@/components/inputs/InputContainer/InputContainer'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePersistentTimer from '@/hooks/usePersistentTimer'
import usePressKey from '@/hooks/usePressKey'
import useModalStore from '@/stores/modalStore'


type PasswordRecoveryFormikType = {
  email: string
}


const PasswordRecoveryPage = () => {
  const {
    openModal,
    closeModal,
    setNotification
  } = useModalStore()
  const isClient = useIsClient()
  const [showEmails, setShowEmails] = useState<boolean>(false)
  const {
    timer,
    startTimer,
    timerIsRunning
  } = usePersistentTimer({
    storageKey: 'recovery-resend-timer',
    time: 30
  })


  usePressKey('Enter', () => {
    passwordRecoveryFormik.handleSubmit()
  })


  const passwordRecoveryFormik = useFormik<PasswordRecoveryFormikType>({
    initialValues: {
      email: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email(AUTH_INPUT_ERRORS['invalid-email']).required(AUTH_INPUT_ERRORS.required)
    }),
    validateOnChange: false,
    onSubmit: async ({ email }) => {
      openModal('loadingModal', {
        title: 'Sending email',
        content: 'Plase wait...'
      })

      try {
        const { ok } = await passwordRecoveryChange({
          request_type: 'reset',
          email
        })

        if (ok) {
          setNotification({
            severity: 'success',
            summary: 'Email sent! Please check your inbox'
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


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <form
        className="AuthLayout__Section"
        onSubmit={(e) => {
          e.preventDefault()
          passwordRecoveryFormik.handleSubmit()
        }}
      >
        <h1 className="AuthLayout__Title">
          Enter your email
        </h1>

        <div className="flex w-full flex-col gap-4">
          <p className="text-regular-16 text-center leading-5 text-surface-800">
            We will send you an email with a link to change your password
          </p>
          <p className="text-regular-16 text-center leading-5 text-surface-800">
            Make sure to check the spam folder
          </p>
        </div>

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
          error={passwordRecoveryFormik.errors.email}
        >
          <InputText
            name="email"
            id="email"
            inputMode="email"
            placeholder="Type your email"
            value={passwordRecoveryFormik.values.email}
            onChange={passwordRecoveryFormik.handleChange}
            invalid={Boolean(passwordRecoveryFormik.errors.email)}
            autoComplete="email"
            keyfilter='email'
            disabled={passwordRecoveryFormik.isSubmitting}
            aria-disabled={passwordRecoveryFormik.isSubmitting}
          />
        </InputContainer>

        <div className="flex w-full flex-col gap-4">
          <CustomButton
            className="w-full"
            type="submit"
            disabled={passwordRecoveryFormik.isSubmitting || timerIsRunning}
            aria-disabled={passwordRecoveryFormik.isSubmitting || timerIsRunning}
          >
            {timerIsRunning ? `Wait ${timer}s to resend` : 'Send email'}
          </CustomButton>

          <CustomButton
            variant='transparent'
            href='/login'
            className='w-full'
            disabled={passwordRecoveryFormik.isSubmitting}
            aria-disabled={passwordRecoveryFormik.isSubmitting}
          >
            Go back to <span className="font-bold">Log in</span>
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default PasswordRecoveryPage
