'use client'
import './ChangePasswordConfirmationPage.sass'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { Password } from 'primereact/password'
import { useEffect, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { checkPasswordToken, passwordConfirm } from '@/api/auth'
import CustomButton from '@/components/CustomButton/CustomButton'
import InputContainer from '@/components/inputs/InputContainer/InputContainer'
import PasswordValidation from '@/components/PasswordValidator/PasswordValidator'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePressKey from '@/hooks/usePressKey'
import useModalStore from '@/stores/modalStore'
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
    openModal,
    closeModal,
    setNotification
  } = useModalStore()
  const { user } = useUserStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [tokenStatus, setTokenStatus] = useState<TokenStatusType>('loading')
  const verifyTokenRef = useRef(false)


  usePressKey('Enter', () => {
    if (tokenStatus === 'valid') {
      changeConfirmationFormik.handleSubmit()
    }
  })


  // Verify token logic
  useEffect(() => {
    if (verifyTokenRef.current) return
    verifyTokenRef.current = true
    openModal('loadingModal', {
      title: 'Verifying link',
      content: 'Please wait...'
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

      closeModal('loadingModal')
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
      openModal('loadingModal', {
        title: 'Changing password',
        content: 'Please wait...'
      })

      try {
        const { ok } = await passwordConfirm({
          token,
          email: user?.email as string,
          password
        })

        if (ok) {
          setNotification({
            severity: 'success',
            summary: 'Password changed successfully!',
            detail: 'Redirecting to home page...'
          })

          setTimeout(() => router.replace('/'), 3000)
        } else {
          setNotification({
            severity: 'error',
            summary: 'Error changing password, please try again later',
            life: 5000
          })
        }
      } catch (error) {
        setNotification({
          severity: 'error',
          summary: 'Error changing password, please try again later',
          life: 5000
        })
        // ! Sentry
        console.error(`Error: ${error}`)
      } finally {
        closeModal('loadingModal')
      }
    }
  })


  if (!isClient || tokenStatus === 'loading') return null

  return (
    <main id="main" className="AuthLayout">
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
            <i className="pi pi-exclamation-triangle text-center text-48 text-orange-600"/>

            <p className="text-regular-16 text-center text-surface-800">
              The link you&apos;ve used is no longer available
            </p>

            <CustomButton
              className="w-full"
              href='/change-password'
              replace
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
