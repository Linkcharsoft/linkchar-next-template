'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useIsClient } from 'usehooks-ts'
import { passwordRecoveryChange } from '@/api/users'
import useAppContext from '@/hooks/useAppContext'
import useUserContext from '@/hooks/useUserContext'
import { useSession } from 'next-auth/react'
import { Button } from 'primereact/button'


const ChangePasswordPage = () => {
  const { data: session, status: statusSession } = useSession()
  const { user } = useUserContext()
  const {
    showLoadingModal,
    hideLoadingModal
  } = useAppContext()
  const isClient = useIsClient()
  const router = useRouter()
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)


  useEffect(() => {
    if (statusSession === 'loading') return
    if(!session?.user.accessToken || !user) {
      router.replace('/')
    }
  }, [session, user, statusSession])



  const handleGetEmail = async () => {
    showLoadingModal({})
    setButtonDisabled(true)

    setTimeout(() => {
      setButtonDisabled(false)
    }, 30000) // 30 seconds interval. Preventing spam

    try {
      const { ok } = await passwordRecoveryChange({
        request_type: 'change',
        email: user.email
      })

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


  if (!isClient || session?.user.accessToken || !user) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Change password
        </h1>

        <div className="mx-auto flex w-[243px] flex-col gap-4">
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            We will send you an email to{' '}
            <span className="font-semibold">{ user?.email }</span> with a link to
            change your password.
          </p>
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            Make sure to check the spam folder.
          </p>
        </div>

        <div className="flex w-full justify-center">
          <Button
            onClick={handleGetEmail}
            className="w-full"
            disabled={buttonDisabled}
          >
            Get email
          </Button>
        </div>
      </section>
    </main>
  )
}

export default ChangePasswordPage
