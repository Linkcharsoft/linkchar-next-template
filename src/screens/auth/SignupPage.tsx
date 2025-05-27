'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useMemo, useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { signup } from '@/api/users'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import validatePassword from '@/utils/validatePassword'


type SignupFormikType = {
  email: string
  password: string
}


const SignupPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal
  } = useAppStore()
  const router = useRouter()
  const isClient = useIsClient()

  const [ error, setError ] = useState<string | null>(null)


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


  const formik = useFormik<SignupFormikType>({
    initialValues: {
      email: '',
      password: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Enter a valid email address').required('Required'),
      password: Yup.string().required('Required')
    }),
    validateOnChange: false,
    onSubmit: async (values, { setErrors }) => {
      showLoadingModal({})

      try {
        const { ok, error } = await signup({
          email: values.email,
          password1: values.password,
          password2: values.password
        })

        if (!ok) {
          const emailError = error as { email?: string[] }
          if (
            emailError.email &&
            emailError.email.length &&
            emailError.email[0]?.includes('Enter a valid email address.')
          ) {
            setErrors({ email: emailError.email[0] })
          }
          if (
            emailError.email &&
            emailError.email.length &&
            emailError.email[0].includes(
              'A user is already registered with this e-mail address.'
            )
          ) {
            setErrors({ email: emailError.email[0] })
          }

          if ((error as { password?: string[] }).password && (error as { password?: string[] }).password?.length) {
            setErrors({ password: 'Invalid password.' })
          }
        } else {
          handleConfirmationRedirect(values.email)
        }
      } catch (error) {
        console.error(`Error signing up: ${error}`)
      } finally {
        setError('An error occurred. Please try again.')
        setTimeout(() => hideLoadingModal(), 500)
      }
    }
  })


  const handleLoginRedirect = () => router.push('/login')

  const handleConfirmationRedirect = (email) => {
    router.push(`/email-validation/${encodeURIComponent(email)}`)
  }


  const PASSWORD_VALIDATION = useMemo(() => validatePassword(formik.values.password), [formik.values.password])


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Sign up
        </h1>
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
            <InputError message={formik.errors.email} />
          </div>
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
                    className={PASSWORD_VALIDATION.length ? 'pi pi-check' : 'pi pi-times'}
                    style={{ color: PASSWORD_VALIDATION.length ? '#188A42' : '#D9342B' }}
                  />
                  <span className={PASSWORD_VALIDATION.length ? 'text-green-700' : 'text-red-600'}>
                    Minimum of 8 characters.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <i
                    className={PASSWORD_VALIDATION.uppercase ? 'pi pi-check' : 'pi pi-times'}
                    style={{ color: PASSWORD_VALIDATION.uppercase ? '#188A42' : '#D9342B' }}
                  />
                  <span className={PASSWORD_VALIDATION.uppercase ? 'text-green-700' : 'text-red-600'}>
                    Must contain at least one uppercase letter.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <i
                    className={PASSWORD_VALIDATION.notNumeric ? 'pi pi-check' : 'pi pi-times'}
                    style={{ color: PASSWORD_VALIDATION.notNumeric ? '#188A42' : '#D9342B' }}
                  />
                  <span className={PASSWORD_VALIDATION.notNumeric ? 'text-green-700' : 'text-red-600'}>
                    Cannot be entirely numeric.
                  </span>
                </div>
              </div>
            )}
          </div>
          <InputError message={error ?? ''} />
        </div>
        <div className="flex w-full justify-center">
          <Button
            onClick={e => {
              e.preventDefault()
              formik.handleSubmit()
            }}
            disabled={formik.isSubmitting}
            className="w-full"
            type="submit"
          >
            Sign up
          </Button>
        </div>
        <div className="flex w-full justify-center">
          <Button onClick={handleLoginRedirect} link className="ButtonLink">
            <p className="font-normal text-surface-800">
              Already have an account?{' '}
              <span className="font-bold text-surface-800">Log in</span>
            </p>
          </Button>
        </div>
      </section>
    </main>
  )
}

export default SignupPage
