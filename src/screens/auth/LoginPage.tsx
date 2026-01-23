'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { resendEmailConfirmation } from '@/api/auth'
import CustomButton from '@/components/CustomButton'
import InputContainer from '@/components/InputContainer'
import { AUTH_INPUT_ERRORS, AUTHENTICATED_HOME_PATH } from '@/constants/auth'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import useUserStore from '@/stores/userStore'


type LoginFormikType = {
  email: string
  password: string
}


const LoginPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const { setUser } = useUserStore()
  const isClient = useIsClient()
  const router = useRouter()


  usePressKey('Enter', () => {
    loginFormik.handleSubmit()
  })


  const loginFormik = useFormik<LoginFormikType>({
    initialValues: {
      email: '',
      password: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email(AUTH_INPUT_ERRORS['invalid-email']).required(AUTH_INPUT_ERRORS.required),
      password: Yup.string().required(AUTH_INPUT_ERRORS.required)
    }),
    validateOnChange: false,
    onSubmit: async (values, { setErrors }) => {
      showLoadingModal({
        title: 'Logging in',
        message: 'Please wait...'
      })

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password
          })
        })

        if(response.ok) {
          const user = await response.json()

          setUser(user)
          router.replace(AUTHENTICATED_HOME_PATH)

          setToastMessage({
            severity: 'success',
            summary: 'Login successful',
            life: 3000
          })
        } else {
          const errors = await response.json()

          if(errors.non_field_errors?.[0]?.includes('mail is not verified')) {
            setToastMessage({
              severity: 'error',
              summary: 'Email not verified',
              detail: 'Redirecting to email validation page...',
              life: 5000
            })
            setErrors({ email: AUTH_INPUT_ERRORS['verify-email'] })

            resendEmailConfirmation({ email: values.email })

            setTimeout(() => {
              router.push(`/signup/email-validation/${encodeURIComponent(values.email)}`)
            }, 1000)
          } else {
            setErrors({
              email: AUTH_INPUT_ERRORS['invalid-email-or-password'],
              password: AUTH_INPUT_ERRORS['invalid-email-or-password']
            })
          }
        }
      } catch (error) {
        setErrors({
          email: AUTH_INPUT_ERRORS.general,
          password: AUTH_INPUT_ERRORS.general
        })
        // ! Sentry
        console.error(`Error: ${error.message}`)
      } finally {
        hideLoadingModal()
      }
    }
  })


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <form
        className="AuthLayout__Section"
        onSubmit={e => {
          e.preventDefault()
          loginFormik.handleSubmit()
        }}
      >
        <h1 className="AuthLayout__Title">
          Log in
        </h1>

        <div className="flex flex-col gap-6">
          <InputContainer
            label='Email'
            htmlFor='email'
            error={loginFormik.errors.email}
          >
            <InputText
              name="email"
              id="email"
              inputMode="email"
              placeholder="Type your email"
              value={loginFormik.values.email}
              onChange={loginFormik.handleChange}
              invalid={Boolean(loginFormik.errors.email)}
              autoComplete="email"
              // keyfilter='email'
              disabled={loginFormik.isSubmitting}
              aria-disabled={loginFormik.isSubmitting}
            />
          </InputContainer>

          <InputContainer
            label='Password'
            htmlFor='password'
            error={loginFormik.errors.password}
          >
            <Password
              name="password"
              id="password"
              placeholder="Type your password"
              onChange={loginFormik.handleChange}
              value={loginFormik.values.password}
              invalid={Boolean(loginFormik.errors.password)}
              autoComplete="current-password"
              toggleMask
              feedback={false}
              pt={{
                input: {
                  className: 'w-full'
                }
              }}
              disabled={loginFormik.isSubmitting}
              aria-disabled={loginFormik.isSubmitting}
            />
          </InputContainer>
        </div>

        <div className="flex w-full flex-col gap-4">
          <CustomButton
            variant='transparent'
            href='/password-recovery'
            className='w-full'
            type='button'
            disabled={loginFormik.isSubmitting}
            aria-disabled={loginFormik.isSubmitting}
          >
            <span className='text-surface-800'>
              Forgot password? <span className="font-bold">Recover it</span>
            </span>
          </CustomButton>

          <CustomButton
            className="w-full"
            type="submit"
            disabled={loginFormik.isSubmitting}
            aria-disabled={loginFormik.isSubmitting}
          >
            Log in
          </CustomButton>

          <CustomButton
            variant='transparent'
            href='/signup'
            className='w-full'
            type='button'
            disabled={loginFormik.isSubmitting}
            aria-disabled={loginFormik.isSubmitting}
          >
            Don&apos;t have an account? <span className="font-bold">Sign up</span>
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default LoginPage
