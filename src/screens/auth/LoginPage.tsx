'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import usePressKey from '@/hooks/usePressKey'
import { useAppStore } from '@/stores/appStore'


type LoginFormikType = {
  email: string
  password: string
}


const LoginPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal
  } = useAppStore()
  const router = useRouter()
  const isClient = useIsClient()


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
        const result = await signIn('credentials', {
          redirect: false,
          email: values.email,
          password: values.password,
        })

        if (result?.ok) {
          const updatedSession = await getSession()
          if (updatedSession) {
            router.replace('/success-login')
          }
        } else {
          setErrors({ password: 'Invalid email or password' })
        }
      } catch (error) {
        setErrors({ password: 'Something went wrong, please try again later' })
        console.error(error)
      } finally {
        setTimeout(() => hideLoadingModal(), 1000)
      }
    }
  })


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


  const handleSignUpRedirect = () => {
    router.push('/signup')
  }
  const handlePasswordRecoreryRedirect = () => {
    router.push('/recovery-password')
  }


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Log in
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
              // keyfilter='email'
            />
            <InputError message={formik.errors.email} />
          </div>
          <div className="w-full flex flex-col gap-[10px]">
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
            />
            <InputError message={formik.errors.password} />
          </div>
        </div>

        <div className="flex w-full justify-center">
          <Button
            link
            className="ButtonLink"
            onClick={handlePasswordRecoreryRedirect}
          >
            <p className="font-normal text-surface-800">
              Forgot password?{' '}
              <span className="font-bold text-surface-800">Recover it</span>
            </p>
          </Button>
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
            Log in
          </Button>
        </div>

        <div className="flex w-full justify-center">
          <Button
            link
            className="ButtonLink"
            onClick={handleSignUpRedirect}
          >
            <p className="font-normal text-surface-800">
              Don&apos;t have an account?{' '}
              <span className="font-bold text-surface-800">Sign up</span>
            </p>
          </Button>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
