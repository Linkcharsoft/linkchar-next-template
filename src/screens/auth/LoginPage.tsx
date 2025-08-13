'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import CustomButton from '@/components/CustomButton'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'
import useUserStore from '@/stores/userStore'


type LoginFormikType = {
  email: string
  password: string
}

const SUCCES_REDIRECT = '/'


const LoginPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppStore()
  const { setUser } = useUserStore()
  const router = useRouter()
  const isClient = useIsClient()


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


  const formik = useFormik<LoginFormikType>({
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
      showLoadingModal({
        title: 'Logging in',
        message: 'Please wait...',
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
          router.replace(SUCCES_REDIRECT)

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
              detail: 'Redirecting to email validation page',
              life: 3000
            })
            setTimeout(() => {
              router.push(`/signup/email-validation/${encodeURIComponent(values.email)}`)
            }, 500)
          } else {
            setErrors({
              email: 'Invalid email or password',
              password: 'Invalid email or password'
            })
          }
        }
      } catch (error) {
        setErrors({ password: 'Something went wrong, please try again' })
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
          formik.handleSubmit()
        }}
      >
        <h1 className="AuthLayout__Title">
          Log in
        </h1>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
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
              // keyfilter='email'
              disabled={formik.isSubmitting}
              aria-disabled={formik.isSubmitting}
            />
            <InputError message={formik.errors.email} />
          </div>
          <div className="w-full flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Password
              name="password"
              id="password"
              placeholder="Type your password"
              onChange={formik.handleChange}
              value={formik.values.password}
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
        </div>

        <div className="flex w-full justify-center">
          <CustomButton
            variant='transparent'
            href='/recovery-password'
            className='w-full'
            type='button'
            disabled={formik.isSubmitting}
            aria-disabled={formik.isSubmitting}
          >
            <span className='text-surface-800'>
              Forgot password? <span className="font-bold">Recover it</span>
            </span>
          </CustomButton>
        </div>

        <div className="flex w-full justify-center">
          <CustomButton
            className="w-full"
            type="submit"
            disabled={formik.isSubmitting}
            aria-disabled={formik.isSubmitting}
          >
            Log in
          </CustomButton>
        </div>

        <div className="flex w-full justify-center">
          <CustomButton
            variant='transparent'
            href='/signup'
            className='w-full'
            type='button'
            disabled={formik.isSubmitting}
            aria-disabled={formik.isSubmitting}
          >
            <span className='text-surface-800'>
              Don&apos;t have an account? <span className="font-bold">Sign up</span>
            </span>
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default LoginPage
