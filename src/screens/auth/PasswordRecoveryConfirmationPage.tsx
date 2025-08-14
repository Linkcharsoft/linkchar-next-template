'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { Button } from 'primereact/button'
import { Password } from 'primereact/password'
import { useEffect, useMemo, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { checkPasswordToken, passwordConfirm } from '@/api/users'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import Loader from '@/components/Loader'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import validatePassword from '@/utils/validatePassword'
import CustomButton from '@/components/CustomButton'


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
  const [ tokenStatus, setTokenStatus ] = useState<TokenStatusType>('loading')


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
      password: Yup.string().required('Required')
    }),
    validate: values => {
      const errors: Partial<typeof values> = {}

      if (values.password) {
        if (values.password.length < 8) errors.password = 'Minimum 8 characters'
        // else if (!RegExp(/\d/).test(values.password))
        //   errors.password = 'At least one number required' WE MIGHT NEED THIS IN FUTURE
        else if (!RegExp(/[A-Z]/).test(values.password))
          errors.password = 'At least one uppercase letter required'
        else if (RegExp(/^\d+$/).test(values.password))
          errors.password = 'Cannot be entirely numeric'
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


  const PASSWORD_VALIDATION = useMemo(() => validatePassword(formik.values.password), [formik.values.password])


  if (!isClient) return null

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

        {(tokenStatus === 'loading') && (
          <div className="mx-auto">
            <Loader/>
          </div>
        )}

        {(tokenStatus === 'invalid') && (
          <>
            <div className="flex w-full justify-center items-center">
              <i className="pi pi-exclamation-triangle text-yellow-500 text-[48px] text-center"/>
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-center text-base font-normal text-surface-800">
                Invalid Link
              </p>
              <p className="text-center text-base font-normal text-surface-800">
                It may have expired
              </p>

              <div className="flex w-full justify-center">
                <CustomButton
                  className="w-full"
                  href='/password-recovery'
                  replace
                  type='button'
                >
                  Please try again
                </CustomButton>
              </div>
            </div>
          </>
        )}

        {(tokenStatus === 'valid') && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Password
                name="password"
                id="password"
                placeholder="Type your password"
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
              <InputError message={formik.errors.password} />
            </div>

            {formik.values.password === '' ? (
              <ul className="list-disc pl-4 text-base font-normal leading-5 text-surface-700">
                <li>Minimum of 8 characters.</li>
                <li>Cannot be entirely numeric.</li>
                <li>Must contain at least one uppercase letter.</li>
              </ul>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <i
                    className={
                      PASSWORD_VALIDATION.length ? 'pi pi-check' : 'pi pi-times'
                    }
                    style={{
                      color: PASSWORD_VALIDATION.length ? '#188A42' : '#D9342B'
                    }}
                  />
                  <span
                    className={
                      PASSWORD_VALIDATION.length
                        ? 'text-green-700'
                        : 'text-red-600'
                    }
                  >
                    Minimum of 8 characters.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <i
                    className={
                      PASSWORD_VALIDATION.uppercase ? 'pi pi-check' : 'pi pi-times'
                    }
                    style={{
                      color: PASSWORD_VALIDATION.uppercase ? '#188A42' : '#D9342B'
                    }}
                  />
                  <span
                    className={
                      PASSWORD_VALIDATION.uppercase
                        ? 'text-green-700'
                        : 'text-red-600'
                    }
                  >
                    Must contain at least one uppercase letter.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <i
                    className={
                      PASSWORD_VALIDATION.notNumeric
                        ? 'pi pi-check'
                        : 'pi pi-times'
                    }
                    style={{
                      color: PASSWORD_VALIDATION.notNumeric ? '#188A42' : '#D9342B'
                    }}
                  />
                  <span
                    className={
                      PASSWORD_VALIDATION.notNumeric
                        ? 'text-green-700'
                        : 'text-red-600'
                    }
                  >
                    Cannot be entirely numeric.
                  </span>
                </div>
              </div>
            )}

            <div className="flex w-full justify-center">
              <CustomButton
                className="w-full"
                type='submit'
                disabled={formik.isSubmitting}
                aria-disabled={formik.isSubmitting}
              >
                Change password
              </CustomButton>
            </div>
          </>
        )}
      </form>
    </main>
  )
}

export default PasswordRecoveryConfirmationPage
