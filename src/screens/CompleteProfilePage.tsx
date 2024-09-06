'use client'
import { useRouter } from 'next/navigation'
import { useIsClient } from 'usehooks-ts'
import * as Yup from 'yup'
import { useFormik } from 'formik'
import InputError from '@/components/InputError'
import Label from '@/components/Label'
import { completeRegistration } from '@/api/users'
import useUserContext from '@/hooks/useUserContext'
import usePressKey from '@/hooks/usePressKey'
import useAppContext from '@/hooks/useAppContext'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'

interface FormPersonalDataValues {
  first_name: string
  last_name: string
  phone: string | null
  general?: string
}
const CompleteProfilePage = () => {
  const { user, mutateUser, token } = useUserContext()
  const { showLoadingModal, hideLoadingModal } = useAppContext()
  const router = useRouter()
  const isClient = useIsClient()

  usePressKey('Enter', () => {
    formik.handleSubmit()
  })

  // La logica de redireccion deberia ir en middleware.ts

  const formik = useFormik<FormPersonalDataValues>({
    initialValues: {
      first_name: '',
      last_name: '',
      phone: ''
    },
    validationSchema: Yup.object({
      first_name: Yup.string().max(150, 'Max: 150 characters').required('Required'),
      last_name: Yup.string().max(150, 'Max: 150 characters').required('Required'),
      phone: Yup.string()
        .matches(/^\+?[0-9]*$/, 'Must be a valid phone number')
        .required('Required')
        .test('len', 'Max: 15 numbers', (val) => {
          if (!val) return false
          const digits = val.replace(/\D/g, '').length
          return digits <= 15
        })
    }),
    validateOnChange: false,
    onSubmit: async (values, { setErrors }) => {
      showLoadingModal({})
      const body = {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone
      }
      const response = await completeRegistration(token, body)

      if (response.ok) {
        mutateUser()
        setTimeout(() => router.replace('/'), 1000)
      } else {
        const errors = response.data.non_field_errors?.[0]
        if (errors) {
          setErrors(errors)
        } else {
          setErrors({ general: 'An error occurred. Please try again.' })
        }
      }
      setTimeout(() => hideLoadingModal(), 1000)
    }
  })

  if (!isClient || !token || !user) return null

  return (
    <>
      <main className="AuthLayout relative h-full w-full overflow-y-auto">
        <section className="AuthLayout__Section my-auto flex h-auto w-full min-w-[300px] max-w-[400px] flex-col gap-8">
          <div className="flex items-center gap-4 self-center">
            <i className="pi pi-check-square" style={{ color: '#9A5FE8', fontSize: '30px' }} />
            <h1 className="text-center text-2xl font-bold leading-none text-surface-900">
              Complete your profile
            </h1>
          </div>
          <div className="flex w-full justify-center align-middle"></div>
          <div className="flex flex-col gap-[23px]">
            <div className="flex flex-col gap-[10px]">
              <Label htmlFor="first_name">First name</Label>
              <InputText
                name="first_name"
                id="first_name"
                placeholder="Type your first name"
                value={formik.values.first_name}
                onChange={formik.handleChange}
                invalid={Boolean(formik.errors.first_name)}
              />
              <InputError message={formik.errors.first_name} />
            </div>
            <div className="flex flex-col gap-[10px]">
              <Label htmlFor="last_name">Last name</Label>
              <InputText
                name="last_name"
                id="last_name"
                placeholder="Type your last name"
                value={formik.values.last_name}
                onChange={formik.handleChange}
                invalid={Boolean(formik.errors.last_name)}
              />
              <InputError message={formik.errors.last_name} />
            </div>
            <div className="flex flex-col gap-[10px]">
              <Label htmlFor="phone">Phone number</Label>
              <InputText
                name="phone"
                id="phone"
                inputMode="tel"
                keyfilter={/[\d+]/}
                placeholder="Type your phone number"
                value={formik.values.phone || ''}
                onChange={formik.handleChange}
                invalid={Boolean(formik.errors.phone)}
              />
              <InputError message={formik.errors.phone} />
            </div>
          </div>
          <InputError message={formik.errors.general} />
          <div className="flex w-full justify-center">
            <Button onClick={() => formik.handleSubmit()} className="mb-14 w-full">
              Complete profile
            </Button>
          </div>
        </section>
      </main>
    </>
  )
}

export default CompleteProfilePage
