'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useIsClient } from 'usehooks-ts'
import { InputText } from 'primereact/inputtext'
import { emailConfirmation, resendEmailConfirmation } from '@/api/users'
import useAppContext from '@/hooks/useAppContext'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import { Button } from 'primereact/button'


type Props = {
  confirmationKey: string
}

type SignupConfirmationFormikType = {
  email: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const SignupConfirmationPage = ({confirmationKey } : Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppContext()
  const router = useRouter()
  const isClient = useIsClient()
  const [ tokenStatus, setTokenStatus ] = useState<TokenStatusType>('invalid')
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)


  useEffect(() => {
    showLoadingModal()
    const verifyToken = async () => {
      const decodedToken = decodeURIComponent(confirmationKey )
      const { ok } = await emailConfirmation({ key: decodedToken })

      if (!ok) {
        setTokenStatus('invalid')
        hideLoadingModal()
      } else {
        setTokenStatus('valid')
        hideLoadingModal()
      }
    }

    verifyToken()
  }, [])


  const formik = useFormik<SignupConfirmationFormikType>({
    initialValues: {
      email: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Enter a valid email address').required('Required')
    }),
    validateOnChange: false,
    onSubmit: async ({ email }) => {
      showLoadingModal()
      setButtonDisabled(true)

      const timeout = setTimeout(() => {
        setButtonDisabled(false)
      }, 30000) // 30 seconds interval. Preventing spam
      try {
        const { ok } = await resendEmailConfirmation({
          email: email
        })

        if (!ok) {
          setToastMessage({
            severity: 'error',
            summary: 'Something went wrong, please try again later',
            life: 30000
          })
        } else {
          setToastMessage({
            severity: 'success',
            summary: 'Email sent!',
            life: 30000
          })
        }
      } catch (error) {
        console.error(`Error sending email: ${error}`)
        setToastMessage({
          severity: 'error',
          summary: 'Something went wrong, please try again later',
          life: 30000
        })
      } finally {
        hideLoadingModal()
        clearTimeout(timeout)
      }
    }
  })


  const handleLoginRedirect = () => router.replace('/login')


  if (!isClient) return null

  if (tokenStatus === 'loading') return null

  if (tokenStatus === 'invalid') {
    return (
      <main className="AuthLayout">
        <section className="AuthLayout__Section">
          <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
            Sign up
          </h1>
          <div className="flex w-full justify-center align-middle">
            <i
              className="pi pi-exclamation-circle"
              style={{ color: '#E5007E', fontSize: '30px' }}
            />
          </div>
          <div className="mx-auto flex w-[243px] flex-col gap-4">
            <p className="text-center text-base font-normal leading-5 text-surface-800">
              The link you&apos;ve used is no longer available, please try entering your email again.
            </p>
            <div className="flex flex-col gap-[23px]">
              <div className="flex flex-col gap-[10px]">
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
                <InputError message={formik.errors.email as string} />
              </div>
            </div>
            <div className="flex w-full justify-center">
              <Button
                onClick={e => {
                  e.preventDefault()
                  formik.handleSubmit()
                }}
                className="w-full mt-3"
                disabled={buttonDisabled}
                type="submit"
              >
                Resend email
              </Button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Sign up
        </h1>
        <div className="mx-auto flex w-[243px] flex-col gap-4">
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            Account successfully verified!
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
      </section>
    </main>
  )
}

export default SignupConfirmationPage
