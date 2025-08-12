'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from 'primereact/button'
import { Password } from 'primereact/password'
import { useEffect, useMemo, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { checkPasswordToken, passwordConfirm } from '@/api/users'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import { useAppStore } from '@/stores/appStore'
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
    showModalState
  } = useAppStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [ tokenStatus, setTokenStatus ] = useState<TokenStatusType>('loading')
  const { data: session } = useSession()


  useEffect(() => {
    showLoadingModal({})
    const checkUrlToken = async () => {
      const decodedToken = decodeURIComponent(token)
      if (session?.user) {
        const { ok } = await checkPasswordToken({
          email: session?.user.email as string,
          token: decodedToken
        })

        if (!ok) {
          setTokenStatus('invalid')
          hideLoadingModal()
        } else {
          setTokenStatus('valid')
          hideLoadingModal()
        }
      }
    }

    checkUrlToken()
  }, [session?.user])


  const formik = useFormik<ChangePasswordConfirmationFormikType>({
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
      showLoadingModal({})
      const decodedToken = decodeURIComponent(token)
      try {
        const { ok } = await passwordConfirm({
          token: decodedToken,
          email: session?.user.email ?? '',
          password
        })
        if (!ok) {
          hideLoadingModal()
          showModalState(
            'error',
            'Error changing password',
            'Something went wrong, please try again later'
          )
        } else {
          hideLoadingModal()
          showModalState(
            'success',
            'Password changed',
            'Your password has been successfully changed'
          )
          router.replace('/')
        }
      } catch (error) {
        console.error(`Error changing password: ${error}`)
      } finally {
        hideLoadingModal()
      }
    }
  })


  const handleRerecoverPasswordRedirect = () => router.replace('/profile')


  const PASSWORD_VALIDATION = useMemo(() => validatePassword(formik.values.password), [formik.values.password])


  if (!isClient || tokenStatus === 'loading') return null

  if (tokenStatus === 'invalid')
    return (
      <main className="AuthLayout">
        <section className="AuthLayout__Section">
          <h1 className="AuthLayout__Title">
            Change Password
          </h1>
          <div className="flex w-full justify-center align-middle">
            <i
              className="pi pi-exclamation-circle"
              style={{ color: '#E5007E', fontSize: '30px' }}
            />
          </div>
          <div className="mx-auto flex w-[243px] flex-col gap-4">
            <p className="text-center text-base font-normal leading-5 text-surface-800">
                The link you&apos;ve used is no longer available.
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
          <h1 className="AuthLayout__Title">
            Enter new password
          </h1>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Password
              name="password"
              id="password"
              onChange={formik.handleChange}
              value={formik.values.password}
              invalid={Boolean(formik.errors.password)}
              placeholder="Type your password"
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

export default ChangePasswordConfirmationPage
