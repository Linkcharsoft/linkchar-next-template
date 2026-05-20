'use client'
import './ChangePasswordPage.sass'
import { AnimatePresence, m } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import { passwordRecoveryChange } from '@/api/auth'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton/CustomButton'
import usePersistentTimer from '@/hooks/usePersistentTimer'
import usePressKey from '@/hooks/usePressKey'
import useModalStore from '@/stores/modalStore'
import useUserStore from '@/stores/userStore'


const ChangePasswordPage = () => {
  const {
    openModal,
    closeModal,
    setNotification
  } = useModalStore()
  const { user } = useUserStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(false)
  const [showEmails, setShowEmails] = useState<boolean>(false)
  const {
    timer,
    startTimer,
    timerIsRunning
  } = usePersistentTimer({
    storageKey: 'change-resend-timer',
    time: 30
  })


  usePressKey('Enter', () => {
    if(!buttonDisabled) handleGetEmail()
  })


  const handleGetEmail = async () => {
    openModal('loadingModal', {
      title: 'Sending email',
      content: 'Plase wait...'
    })
    setButtonDisabled(true)

    try {
      const { ok } = await passwordRecoveryChange({
        request_type: 'change',
        email: user?.email as string
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
      setButtonDisabled(false)
    }
  }


  if (!isClient || !user) return null

  return (
    <main id="main" className="AuthLayout">
      <form
        className="AuthLayout__Section"
        onSubmit={e => {
          e.preventDefault()
          handleGetEmail()
        }}
      >
        <h1 className="AuthLayout__Title">
          Change password
        </h1>

        <div className="flex flex-col gap-4">
          <p className="text-regular-16 text-center text-surface-800">
            We will send you an email to <span className="font-semibold">{ user?.email }</span> with a link to change your password
          </p>
          <p className="text-regular-16 text-center text-surface-800">
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

        <div className="flex w-full flex-col gap-4">
          <CustomButton
            className="w-full"
            type='submit'
            disabled={buttonDisabled || timerIsRunning}
            aria-disabled={buttonDisabled || timerIsRunning}
          >
            {timerIsRunning ? `Wait ${timer}s to resend` : 'Send email'}
          </CustomButton>

          <CustomButton
            variant='transparent'
            onClick={router.back}
            className='w-full'
            type='button'
            disabled={buttonDisabled}
            aria-disabled={buttonDisabled}
          >
            Go back
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default ChangePasswordPage
