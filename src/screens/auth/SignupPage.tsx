'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { useState } from 'react'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { signup } from '@/api/users'
import CustomButton from '@/components/CustomButton'
import InputContainer from '@/components/InputContainer'
import InputError from '@/components/InputError'
import PasswordValidation from '@/components/PasswordValidation'
import { AUTH_INPUT_ERRORS } from '@/constants/auth'
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
  const [generalError, setGeneralError] = useState<string | null>(null)


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


  const formik = useFormik<SignupFormikType>({
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
            console.log(passwordValidations.validations[type])
            errors.password = passwordValidations.validations[type].label
            break
          }
        }
      }

      return errors
    },
    onSubmit: async (values, { setErrors }) => {
      showLoadingModal({
        title: 'Signing up',
        message: 'Please wait...'
      })

      try {
        const { ok, error } = await signup({
          email: values.email,
          password1: values.password,
          password2: values.password
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
          Sign up
        </h1>

        <div className="flex flex-col gap-6">
          <InputContainer
            label='Email'
            htmlFor='email'
            error={formik.errors.email}
          >
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
              disabled={formik.isSubmitting}
              aria-disabled={formik.isSubmitting}
            />
          </InputContainer>

          <div className="flex flex-col gap-4">
            <InputContainer
              label='Password'
              htmlFor='password'
              error={formik.errors.password}
            >
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
            </InputContainer>

            <PasswordValidation password={formik.values.password}/>
          </div>

          <InputError message={generalError ?? ''} />
        </div>

        <div className="w-full flex flex-col gap-4">
          <CustomButton
            className="w-full"
            onClick={e => {
              e.preventDefault()
              formik.handleSubmit()
            }}
            type="submit"
            disabled={formik.isSubmitting}
            aria-disabled={formik.isSubmitting}
          >
            Sign up
          </CustomButton>

          <CustomButton
            variant='transparent'
            href='/login'
            className='w-full'
            type='button'
            disabled={formik.isSubmitting}
            aria-disabled={formik.isSubmitting}
          >
            Already have an account?{' '}<span className="font-bold">Log in</span>
          </CustomButton>
        </div>
      </form>
    </main>
  )
}

export default SignupPage
