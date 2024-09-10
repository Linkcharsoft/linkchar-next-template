'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useIsClient } from 'usehooks-ts'
import { Button } from 'primereact/button'
import { Password } from 'primereact/password'
import { checkPasswordToken, passwordConfirm } from '@/api/users'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import useAppContext from '@/hooks/useAppContext'
import usePressKey from '@/hooks/usePressKey'
import validatePassword from '@/utils/validatePassword'


type Props = {
  token: string,
  email: string
}

type RecoveryPasswordConfirmationFormikType = {
  password: string
}
type TokenStatusType = 'loading' | 'valid' | 'invalid'


const RecoveryPasswordConfirmationPage = ({ token, email }: Props) => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppContext()
  const isClient = useIsClient()
  const router = useRouter()
  const [ tokenStatus, setTokenStatus ] = useState<TokenStatusType>('loading')


  usePressKey('Enter', () => {
    if (tokenStatus === 'valid') {
      formik.handleSubmit()
    }
  })


  useEffect(() => {
    showLoadingModal({})
    const checkUrlToken = async () => {
      const decodedToken = decodeURIComponent(token)
      const decodedEmail = decodeURIComponent(email)
      const { ok } = await checkPasswordToken({
        email: decodedEmail,
        token: decodedToken
      })

      if (!ok) {
        setTokenStatus('valid')
        hideLoadingModal()
      } else {
        setTokenStatus('valid')
        hideLoadingModal()
      }
    }

    checkUrlToken()
  }, [])


  const formik = useFormik<RecoveryPasswordConfirmationFormikType>({
    initialValues: {
      password: ''
    },
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
    validateOnChange: false,
    onSubmit: async ({ password }) => {
      const decodedToken = decodeURIComponent(token)
      const decodedEmail = decodeURIComponent(email)
      const { ok } = await passwordConfirm({
        token: decodedToken,
        email: decodedEmail,
        password
      })
      if (!ok) {
        setToastMessage({
          severity: 'error',
          summary: 'Password change failed',
          life: 3000
        })
      } else {
        setToastMessage({
          severity: 'success',
          summary: 'Password changed successfully!',
          life: 3000
        })
        setTimeout(() => {
          router.replace('/login')
        }, 3000)
      }
    }
  })


  const handleRerecoverPasswordRedirect = () => router.replace('/recovery-password')


  const PASSWORD_VALIDATION = useMemo(() => validatePassword(formik.values.password), [formik.values.password])


  if (!isClient) return null

  if (tokenStatus === 'loading') return null

  if (tokenStatus === 'invalid')
    return (
      <main className="AuthLayout">
        <section className="AuthLayout__Section">
          <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
            Password recory
          </h1>
          <div className="flex w-full justify-center align-middle">
            <i
              className="pi pi-exclamation-circle"
              style={{ color: '#E5007E', fontSize: '30px' }}
            />
          </div>
          <div className="mx-auto flex w-[243px] flex-col gap-4">
            <p className="text-center text-base font-normal leading-5 text-surface-800">
              Invalid Link
            </p>
            <p className="text-center text-base font-normal leading-5 text-surface-800">
              It may have expired.
            </p>
            <div className="mt-8 flex w-full justify-center">
              <Button
                onClick={handleRerecoverPasswordRedirect}
                className="w-full"
              >
                Please try again
              </Button>
            </div>
          </div>
        </section>
      </main>
    )

  if (tokenStatus === 'valid')
    return (
      <main className="AuthLayout">
        <section className="AuthLayout__Section">
          <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
            Enter new password
          </h1>
          <div className="flex flex-col gap-[10px]">
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
            <Button
              onClick={e => {
                e.preventDefault()
                formik.handleSubmit()
              }}
              className="w-full"
            >
              Change password
            </Button>
          </div>
        </section>
      </main>
    )
}

export default RecoveryPasswordConfirmationPage
