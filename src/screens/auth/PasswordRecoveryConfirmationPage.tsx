'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { Password } from 'primereact/password'
import { useEffect, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { checkPasswordToken, passwordConfirm } from '@/api/users'
import CustomButton from '@/components/CustomButton'
import InputContainer from '@/components/InputContainer'
import PasswordValidation from '@/components/PasswordValidation'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import validatePassword from '@/utils/validatePassword'


type Props = {
  token: string,
  email: string
}

type RecoveryPasswordConfirmationFormikType = {
  password: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const PasswordRecoveryConfirmationPage = ({ token, email }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [tokenStatus, setTokenStatus] = useState<TokenStatusType>('loading')


  usePressKey('Enter', () => {
    if (tokenStatus === 'valid') {
      formik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    showLoadingModal({
      title: 'Verifying link',
      message: 'Please wait...'
    })

    const checkUrlToken = async () => {
      const decodedToken = decodeURIComponent(token)
      const decodedEmail = decodeURIComponent(email)

      const { ok } = await checkPasswordToken({
        email: decodedEmail,
        token: decodedToken
      })

      if (ok) {
        setTokenStatus('valid')
      } else {
        setTokenStatus('invalid')
      }

      hideLoadingModal()
    }

    checkUrlToken()
  }, [])

  // Redirect if there isnt token or email
  useEffect(() => {
    if (!token || !email) router.replace('/login')
  }, [token, email])


  const formik = useFormik<RecoveryPasswordConfirmationFormikType>({
    initialValues: {
      password: ''
    },
    validateOnChange: false,
    validationSchema: Yup.object({
      password: Yup.string().required(AUTH_INPUT_ERRORS.required)
    }),
    validate: values => {
      const errors: Partial<typeof values> = {}

      if (values.password) {
        const passwordValidations = validatePassword(values.password)

        for (const type of passwordValidations.types) {
          if (!passwordValidations.validations[type].value) {
            console.log(passwordValidations.validations[type])
            errors.password = passwordValidations.validations[type].label
            break
          }
        }
      }

      return errors
    },
    onSubmit: async ({ password }) => {
      showLoadingModal({
        title: 'Changing password',
        message: 'Please wait...'
      })

      const decodedToken = decodeURIComponent(token)
      const decodedEmail = decodeURIComponent(email)

      try {
        const { ok } = await passwordConfirm({
          token: decodedToken,
          email: decodedEmail,
          password
        })

        if (ok) {
          setToastMessage({
            severity: 'success',
            summary: 'Password changed successfully!',
            detail: 'Redirecting to login page...',
            life: 3000
          })

          setTimeout(() => router.replace('/login'), 3000)
        } else {
          setToastMessage({
            severity: 'error',
            summary: 'Error changing password, please try again later',
            life: 5000
          })
        }
      } catch (error) {
        setToastMessage({
          severity: 'error',
          summary: 'Error changing password, please try again later',
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
          if(tokenStatus === 'valid') {
            formik.handleSubmit()
          }
        }}
      >
        <h1 className="AuthLayout__Title">
          Password recovery
        </h1>

        {(tokenStatus === 'invalid') && (
          <>
            <i className="pi pi-exclamation-triangle text-yellow-500 text-[48px] text-center"/>

            <div className="flex flex-col gap-4">
              <p className="text-center text-base font-normal text-surface-800">
                The link you&apos;ve used is no longer available
              </p>
            </div>

            <CustomButton
              className="w-full"
              href='/password-recovery'
              replace
              type='button'
            >
              Please try again
            </CustomButton>
          </>
        )}

        {(tokenStatus === 'valid') && (
          <>
            <div className="flex flex-col gap-4">
              <InputContainer
                label='New password'
                htmlFor='password'
                error={formik.errors.password}
              >
                <Password
                  name="password"
                  id="password"
                  placeholder="Type your new password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  invalid={Boolean(formik.errors.password)}
                  autoComplete="current-password"
                  toggleMask
                  feedback={false}
                  pt={{
                    input: {
                      className: 'w-full'
                    }
                  }}
                  disabled={formik.isSubmitting}
                  aria-disabled={formik.isSubmitting}
                />
              </InputContainer>

              <PasswordValidation password={formik.values.password}/>
            </div>

            <CustomButton
              className="w-full"
              type='submit'
              disabled={formik.isSubmitting}
              aria-disabled={formik.isSubmitting}
            >
              Change password
            </CustomButton>
          </>
        )}
      </form>
    </main>
  )
}

export default PasswordRecoveryConfirmationPage
