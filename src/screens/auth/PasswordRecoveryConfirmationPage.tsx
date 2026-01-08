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
      recoveryConfirmationFormik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    showLoadingModal({
      title: 'Verifying link',
      message: 'Please wait...'
    })

    const checkUrlToken = async () => {
      const { ok } = await checkPasswordToken({
        email,
        token
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


  const recoveryConfirmationFormik = useFormik<RecoveryPasswordConfirmationFormikType>({
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

      try {
        const { ok } = await passwordConfirm({
          token,
          email,
          password
        })

        if (ok) {
          setToastMessage({
            severity: 'success',
            summary: 'Password changed successfully!',
            detail: 'Redirecting to login page...',
            life: 3000
          })

          setTimeout(() => router.replace('/login'), 1000)
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
            recoveryConfirmationFormik.handleSubmit()
          }
        }}
      >
        <h1 className="AuthLayout__Title">
          Password recovery
        </h1>

        {(tokenStatus === 'invalid') && (
          <>
            <i className="pi pi-exclamation-triangle text-center text-48 text-yellow-500"/>

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
                error={recoveryConfirmationFormik.errors.password}
              >
                <Password
                  name="password"
                  id="password"
                  placeholder="Type your new password"
                  value={recoveryConfirmationFormik.values.password}
                  onChange={recoveryConfirmationFormik.handleChange}
                  invalid={Boolean(recoveryConfirmationFormik.errors.password)}
                  autoComplete="current-password"
                  toggleMask
                  feedback={false}
                  pt={{
                    input: {
                      className: 'w-full'
                    }
                  }}
                  disabled={recoveryConfirmationFormik.isSubmitting}
                  aria-disabled={recoveryConfirmationFormik.isSubmitting}
                />
              </InputContainer>

              <PasswordValidation password={recoveryConfirmationFormik.values.password}/>
            </div>

            <CustomButton
              className="w-full"
              type='submit'
              disabled={recoveryConfirmationFormik.isSubmitting}
              aria-disabled={recoveryConfirmationFormik.isSubmitting}
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
