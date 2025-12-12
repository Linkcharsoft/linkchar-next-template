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
import useUserStore from '@/stores/userStore'
import validatePassword from '@/utils/validatePassword'


type Props = {
  token: string
}

type ChangePasswordConfirmationFormikType = {
  password: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const ChangePasswordConfirmationPage = ({ token }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const { user } = useUserStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [tokenStatus, setTokenStatus] = useState<TokenStatusType>('loading')


  usePressKey('Enter', () => {
    if (tokenStatus === 'valid') {
      changeConfirmationFormik.handleSubmit()
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
        email: user?.email as string,
        token
      })

      if (ok) {
        setTokenStatus('valid')
      } else {
        setTokenStatus('invalid')
      }

      hideLoadingModal()
    }

    if(user) checkUrlToken()
  }, [user])


  const changeConfirmationFormik = useFormik<ChangePasswordConfirmationFormikType>({
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
          email: user?.email as string,
          password
        })

        if (ok) {
          setToastMessage({
            severity: 'success',
            summary: 'Password changed successfully!',
            detail: 'Redirecting to home page...',
            life: 3000
          })

          setTimeout(() => router.replace('/'), 3000)
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
        console.error(`Error: ${error}`)
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
            changeConfirmationFormik.handleSubmit()
          }
        }}
      >
        <h1 className="AuthLayout__Title">
          Change password
        </h1>

        {(tokenStatus === 'invalid') && (
          <>
            <i className="pi pi-exclamation-triangle text-yellow-500 text-[48px] text-center"/>

            <p className="text-center text-base font-normal text-surface-800">
              The link you&apos;ve used is no longer available
            </p>

            <CustomButton
              className="w-full"
              href='/change-password'
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
                error={changeConfirmationFormik.errors.password}
              >
                <Password
                  name="password"
                  id="password"
                  onChange={changeConfirmationFormik.handleChange}
                  value={changeConfirmationFormik.values.password}
                  invalid={Boolean(changeConfirmationFormik.errors.password)}
                  placeholder="Type your new password"
                  autoComplete="current-password"
                  toggleMask
                  feedback={false}
                  pt={{
                    input: {
                      className: 'w-full'
                    }
                  }}
                  disabled={changeConfirmationFormik.isSubmitting}
                  aria-disabled={changeConfirmationFormik.isSubmitting}
                />
              </InputContainer>

              <PasswordValidation password={changeConfirmationFormik.values.password}/>
            </div>

            <CustomButton
              className="w-full"
              type='submit'
              disabled={changeConfirmationFormik.isSubmitting}
              aria-disabled={changeConfirmationFormik.isSubmitting}
            >
              Change password
            </CustomButton>
          </>
        )}
      </form>
    </main>
  )
}

export default ChangePasswordConfirmationPage
