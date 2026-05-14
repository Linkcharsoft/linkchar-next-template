'use client'
import './SignupPage.sass'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { signup } from '@/api/auth'
import CustomButton from '@/components/CustomButton/CustomButton'
import InputContainer from '@/components/inputs/InputContainer/InputContainer'
import InputError from '@/components/inputs/InputError/InputError'
import PasswordValidation from '@/components/PasswordValidator/PasswordValidator'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
import usePressKey from '@/hooks/usePressKey'
import useModalStore from '@/stores/modalStore'
import validatePassword from '@/utils/validatePassword'


type SignupFormikType = {
  email: string
  password: string
}


const SignupPage = () => {
  const {
    openModal,
    closeModal
  } = useModalStore()
  const isClient = useIsClient()
  const router = useRouter()
  const [generalError, setGeneralError] = useState<string | null>(null)


  usePressKey('Enter', () => {
    signupFormik.handleSubmit()
  })


  const signupFormik = useFormik<SignupFormikType>({
    initialValues: {
      email: '',
      password: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email(AUTH_INPUT_ERRORS['invalid-email']).required(AUTH_INPUT_ERRORS.required),
      password: Yup.string().required(AUTH_INPUT_ERRORS.required)
    }),
    validateOnChange: false,
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
    onSubmit: async (values, { setErrors }) => {
      openModal('loadingModal', {
        title: 'Signing up',
        content: 'Please wait...'
      })

      try {
        const isTestUser = localStorage.getItem('test_user')
        const { ok, error } = await signup({
          email: values.email,
          password1: values.password,
          password2: values.password,
          is_test_user: isTestUser === 'true' ? true : false
        })

        if (!ok) {
          const emailError = error as { email?: string[] }
          const passwordError = error as { password1?: string[] }
          const unknownError = error as { non_field_errors?: string[] }

          if (emailError.email && emailError.email.length) {
            return setErrors({ email: emailError.email[0] })
          }

          if (passwordError.password1 && passwordError.password1.length) {
            return setErrors({ password: passwordError.password1[0] })
          }

          if (unknownError.non_field_errors && unknownError.non_field_errors.length) {
            return setErrors({ password: unknownError.non_field_errors[0] })
          }

          throw new Error('An error occurred. Please try again.')
        } else {
          router.push(`/signup/email-validation/${encodeURIComponent(values.email)}`)
        }
      } catch (error) {
        setGeneralError('An error occurred. Please try again.')
        // ! Sentry
        const message = error instanceof Error ? error.message : error
        console.error(`Error: ${message}`)
      } finally {
        closeModal('loadingModal')
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
          signupFormik.handleSubmit()
        }}
      >
        <h1 className="AuthLayout__Title">
          Sign up
        </h1>

        <div className="flex flex-col gap-6">
          <InputContainer
            label='Email'
            htmlFor='email'
            error={signupFormik.errors.email}
          >
            <InputText
              name="email"
              id="email"
              inputMode="email"
              placeholder="Type your email"
              value={signupFormik.values.email}
              onChange={signupFormik.handleChange}
              invalid={Boolean(signupFormik.errors.email)}
              autoComplete="email"
              keyfilter='email'
              disabled={signupFormik.isSubmitting}
              aria-disabled={signupFormik.isSubmitting}
            />
          </InputContainer>

          <div className="flex flex-col gap-4">
            <InputContainer
              label='Password'
              htmlFor='password'
              error={signupFormik.errors.password}
            >
              <Password
                name="password"
                id="password"
                placeholder="Type your password"
                value={signupFormik.values.password}
                onChange={signupFormik.handleChange}
                invalid={Boolean(signupFormik.errors.password)}
                autoComplete="current-password"
                toggleMask
                feedback={false}
                pt={{
                  input: {
                    className: 'w-full'
                  }
                }}
                disabled={signupFormik.isSubmitting}
                aria-disabled={signupFormik.isSubmitting}
              />
            </InputContainer>

            <PasswordValidation password={signupFormik.values.password}/>
          </div>

          <InputError message={generalError ?? ''} />
        </div>

        <div className="flex w-full flex-col gap-4">
          <CustomButton
            className="w-full"
            onClick={e => {
              e.preventDefault()
              signupFormik.handleSubmit()
            }}
            type="submit"
            disabled={signupFormik.isSubmitting}
            aria-disabled={signupFormik.isSubmitting}
          >
            Sign up
          </CustomButton>

          <CustomButton
            variant='transparent'
            href='/login'
            className='w-full'
            disabled={signupFormik.isSubmitting}
            aria-disabled={signupFormik.isSubmitting}
          >
            Already have an account?{' '}<span className="font-bold">Log in</span>
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default SignupPage
