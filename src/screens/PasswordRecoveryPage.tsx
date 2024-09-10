'use client'
import { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { useIsClient } from 'usehooks-ts'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { passwordRecoveryChange } from '@/api/users'
import useAppContext from '@/hooks/useAppContext'
import usePressKey from '@/hooks/usePressKey'
import InputError from '@/components/InputError'
import Label from '@/components/Label'


type PasswordRecoveryFormikType = {
  email: string
}


const PasswordRecoveryPage = () => {
  const {
    showLoadingModal,
    hideLoadingModal,
    setToastMessage
  } = useAppContext()
  const isClient = useIsClient()
  const [ buttonDisabled, setButtonDisabled ] = useState<boolean>(false)
  const [ isFirstClick, setIsFirstClick ] = useState<boolean>(true)


  usePressKey('Enter', () => {
    formik.handleSubmit()
  })


  const formik = useFormik<PasswordRecoveryFormikType>({
    initialValues: {
      email: ''
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Enter a valid email address').required('Required')
    }),
    validateOnChange: false,
    onSubmit: async ({ email }) => {
      showLoadingModal({})
      setButtonDisabled(true)

      try {
        const { ok } = await passwordRecoveryChange({
          request_type: 'reset',
          email: email
        })

        if (!ok) {
          setToastMessage({
            severity: 'error',
            summary: 'Something went wrong, please try again later',
            life: 3000
          })
          setTimeout(() => {
            setButtonDisabled(false)
          }, 30000)
        } else {
          setToastMessage({
            severity: 'success',
            summary: 'Email sent!',
            life: 3000
          })
          setTimeout(() => {
            setButtonDisabled(false)
          }, 30000)
          setIsFirstClick(false)
        }
      } catch (error) {
        console.error(`Error sending email: ${error}`)
      } finally {
        hideLoadingModal()
      }
    }
  })


  if (!isClient) return null

  return (
    <main className="AuthLayout">
      <section className="AuthLayout__Section">
        <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
          Enter your email
        </h1>
        <div className="mx-auto flex w-[243px] flex-col gap-4">
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            We will send you an email with a link to change your password.
          </p>
          <p className="text-center text-base font-normal leading-5 text-surface-800">
            Make sure to check the spam folder.
          </p>
        </div>
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
        </div>
        <div className="flex w-full justify-center">
          <Button
            onClick={e => {
              e.preventDefault()
              formik.handleSubmit()
            }}
            className="w-full"
            disabled={buttonDisabled}
            type="submit"
          >
            {isFirstClick ? 'Get email' : 'Re-send email'}
          </Button>
        </div>
      </section>
    </main>
  )
}

export default PasswordRecoveryPage
