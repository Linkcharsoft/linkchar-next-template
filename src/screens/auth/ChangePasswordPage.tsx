'use client'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useIsClient, useSessionStorage } from 'usehooks-ts'
import { passwordRecoveryChange } from '@/api/users'
import GmailIcon from '@/assets/icons/GmailIcon'
import OutlookIcon from '@/assets/icons/OutlookIcon'
import CustomButton from '@/components/CustomButton'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import useUserStore from '@/stores/userStore'


const ChangePasswordPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const { user } = useUserStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)
  const [ showEmails, setShowEmails ] = useState<boolean>(false)
  const [ timer, setTimer ] = useSessionStorage<number>('change-resend-timer', 0)


  usePressKey('Enter', () => {
    if(!buttonDisabled) handleGetEmail()
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


  const handleGetEmail = async () => {
    showLoadingModal({
      title: 'Sending email',
      message: 'Plase wait...'
    })
    setButtonDisabled(true)

    try {
      const { ok } = await passwordRecoveryChange({
        request_type: 'change',
        email: user?.email as string
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
      console.error(`Error: ${error.message}`)
    } finally {
      hideLoadingModal()
      setButtonDisabled(false)
    }
  }


  if (!isClient || !user) return null

  return (
    <main className="AuthLayout">
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
          <p className="text-center text-base font-normal text-surface-800">
            We will send you an email to <span className="font-semibold">{ user?.email }</span> with a link to change your password
          </p>
          <p className="text-center text-base font-normal text-surface-800">
            Make sure to check the spam folder
          </p>
        </div>

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

        <div className="flex w-full justify-center">
          <CustomButton
            className="w-full"
            type='submit'
            disabled={buttonDisabled || timer > 0}
            aria-disabled={buttonDisabled || timer > 0}
          >
            {timer > 0 ? `Wait ${timer}s to resend` : 'Send email'}
          </CustomButton>
        </div>

        <CustomButton
          variant='transparent'
          onClick={() => router.back()}
          className='w-full'
          type='button'
          disabled={buttonDisabled}
          aria-disabled={buttonDisabled}
        >
          <span className='text-surface-800 font-bold'>
            Go back
          </span>
        </CustomButton>
      </form>
    </main>
  )
}

export default ChangePasswordPage
