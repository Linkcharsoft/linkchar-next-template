'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import classNames from 'classnames'
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


interface FormPersonalDataValues {
  first_name: string
  last_name: string
  phone: string | null
}
interface FormOrganizationDataValues {
  organization: string
  role: string
  other_role: string
  general?: string
}

const ROLES = [
  'Advisor',
  'Architect',
  'Business Owner',
  'CEO/CTO/CCO/CFO',
  'Consultant',
  'Designer',
  'Engineer',
  'Plant manager',
  'Sales engineer',
  'Sales manager',
  'Technical manager',
  'Others'
]


const CompleteProfilePage = () => {
  const {
    user,
    mutateUser,
    token,
    sessionStatus
  } = useUserContext()
  const { showLoadingModal, hideLoadingModal } = useAppContext()
  const [ step, setStep ] = useState<1 | 2>(1)
  const router = useRouter()
  const isClient = useIsClient()


  usePressKey('Enter', () => {
    if (step === 1) {
      formikPersonalData.handleSubmit()
    } else if (step === 2) {
      formikOrganizationData.handleSubmit()
    }
  })


  useEffect(() => {
    if (sessionStatus === 'loading') return
    if(!token || !user) {
      router.replace('/login')
    }
    // if (user?.profile?.is_register_complete) {
    //   router.replace('/')
    // }
  }, [token, user, sessionStatus])


  const formikPersonalData = useFormik<FormPersonalDataValues>({
    initialValues: {
      first_name: '',
      last_name: '',
      phone: '',
    },
    validationSchema: Yup.object({
      first_name: Yup.string().max(150, 'Max: 150 characters').required('Required'),
      last_name: Yup.string().max(150, 'Max: 150 characters').required('Required'),
      phone: Yup.string()
        .matches(/^\+?[0-9]*$/, 'Must be a valid phone number')
        .required('Required')
        .test('len', 'Max: 15 numbers', val => {
          if (!val) return false
          const digits = val.replace(/\D/g, '').length
          return digits <= 15
        }),
    }),
    validateOnChange: false,
    onSubmit: () => {
      handleNextStep()
    }
  })

  const formikOrganizationData = useFormik<FormOrganizationDataValues>({
    initialValues: {
      organization: '',
      role: '',
      other_role: ''
    },
    validate: values => {
      const errors: Record<string, string> = {}
      if (values.role === 'Others' && !values.other_role) {
        errors.other_role = 'Other role is required.'
      }
      return errors
    },
    validationSchema: Yup.object({
      organization: Yup.string().max(255, 'Max: 255 characters').required('Required'),
      role: Yup.string().required('Required'),
      other_role: Yup.string().when('role', {
        is: (role: string) => role === 'Others',
        then: (schema) => schema.max(255, 'Max: 255 characters').required('Required'),
        otherwise: (schema) => schema
      })
    }),
    validateOnChange: false,
    onSubmit: async (values, { setErrors }) => {
      showLoadingModal({})
      const cleanPhoneNumber = formikPersonalData?.values?.phone?.replace(/[()\s-]/g, '') || null
      const body = {
        first_name: formikPersonalData.values.first_name,
        last_name: formikPersonalData.values.last_name,
        profile: {
          phone: cleanPhoneNumber,
          organization: values.organization,
          role: values.role,
          ...(values.role === 'Others' && { other_role: values.other_role })
        }
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


  const handleNextStep = () => {
    setStep(2)
  }


  if (!isClient || !token || !user) return null

  return (
    <>
      {step === 1 && (
        <main className="AuthLayout relative h-full w-full overflow-y-auto">
          <section className="AuthLayout__Section my-auto flex h-auto w-full min-w-[300px] max-w-[400px] flex-col gap-8">
            <div className="flex w-full gap-2 p-4">
              <div className={classNames('Steps', { active: step === 1 })} />
              <div className="Steps" />
            </div>
            <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
              Complete your profile
            </h1>
            <div className="flex w-full justify-center align-middle">
              <i
                className="pi pi-check-square"
                style={{ color: '#E5007E', fontSize: '30px' }}
              />
            </div>
            <div className="flex flex-col gap-[23px]">
              <div className="flex flex-col gap-[10px]">
                <Label htmlFor="first_name">First name</Label>
                <InputText
                  name="first_name"
                  id="first_name"
                  placeholder="Type your first name"
                  value={formikPersonalData.values.first_name}
                  onChange={formikPersonalData.handleChange}
                  invalid={Boolean(formikPersonalData.errors.first_name)}
                />
                <InputError
                  message={formikPersonalData.errors.first_name}
                />
              </div>
              <div className="flex flex-col gap-[10px]">
                <Label htmlFor="last_name">Last name</Label>
                <InputText
                  name="last_name"
                  id="last_name"
                  placeholder="Type your last name"
                  value={formikPersonalData.values.last_name}
                  onChange={formikPersonalData.handleChange}
                  invalid={Boolean(formikPersonalData.errors.last_name)}
                />
                <InputError
                  message={formikPersonalData.errors.last_name}
                />
              </div>
              <div className="flex flex-col gap-[10px]">
                <Label htmlFor="phone">Phone number</Label>
                <InputText
                  name="phone"
                  id="phone"
                  inputMode='tel'
                  keyfilter={/[\d+]/}
                  placeholder="Type your phone number"
                  value={formikPersonalData.values.phone || ''}
                  onChange={formikPersonalData.handleChange}
                  invalid={Boolean(formikPersonalData.errors.phone)}
                />
                <InputError
                  message={formikPersonalData.errors.phone}
                />
              </div>
            </div>
            <div className="flex w-full justify-center">
              <Button
                onClick={() => formikPersonalData.handleSubmit()}
                className="mb-14 w-full"
              >
                Continue
              </Button>
            </div>
          </section>
        </main>
      )}
      {step === 2 && (
        <main className="AuthLayout relative h-full w-full overflow-y-auto">
          <section className="AuthLayout__Section my-auto flex h-auto w-full min-w-[300px] max-w-[400px] flex-col gap-8">
            <div className="flex w-full gap-2 p-4">
              <div className={classNames('Steps', { active: step === 2 })} />
              <div className={classNames('Steps', { active: step === 2 })} />
            </div>
            <h1 className="mx-auto text-center text-2xl font-bold leading-none text-surface-900">
              Complete your profile
            </h1>
            <div className="flex w-full justify-center align-middle">
              <i
                className="pi pi-check-square"
                style={{ color: '#E5007E', fontSize: '30px' }}
              />
            </div>
            <div className="flex flex-col gap-[23px]">
              <div className="flex flex-col gap-[10px]">
                <Label htmlFor="organization">Organization name</Label>
                <InputText
                  name="organization"
                  id="organization"
                  placeholder="Type your organization name"
                  value={formikOrganizationData.values.organization}
                  onChange={formikOrganizationData.handleChange}
                  invalid={Boolean(formikOrganizationData.errors.organization)}
                />
                <InputError
                  message={formikOrganizationData.errors.organization}
                />
              </div>
              <div className="flex flex-col gap-[10px]">
                <Label htmlFor="role">Role</Label>
                <Dropdown
                  className="md:w-14rem w-full"
                  name="role"
                  id="role"
                  placeholder="Select an option"
                  value={formikOrganizationData.values.role}
                  onChange={e => {
                    formikOrganizationData.setFieldValue('role', e.value)
                  }}
                  options={ROLES.map(role => ({ label: role, value: role }))}
                  invalid={Boolean(formikOrganizationData.errors.role)}
                />
                <InputError
                  message={formikOrganizationData.errors.role}
                />
              </div>
              {
                formikOrganizationData.values.role &&
                formikOrganizationData.values.role === 'Others' &&
                (
                  <div className="flex flex-col gap-[10px]">
                    <Label htmlFor="other_role">Typed Role</Label>
                    <InputText
                      name="other_role"
                      id="other_role"
                      placeholder="Type your specific role"
                      value={formikOrganizationData.values.other_role}
                      onChange={formikOrganizationData.handleChange}
                      invalid={Boolean(formikOrganizationData.errors.other_role)}
                    />
                    <InputError message={formikOrganizationData.errors.other_role}/>
                  </div>
                )
              }
            </div>
            <InputError
              message={formikOrganizationData.errors.general}
            />
            <div className="flex flex-col gap-4 w-full justify-center">
              <Button
                onClick={() => formikOrganizationData.handleSubmit()}
                className="w-full"
              >
                Complete profile
              </Button>

              <Button
                onClick={() => setStep(1)}
                className="w-full"
              >
                Back
              </Button>
            </div>
          </section>
        </main>
      )}
    </>
  )
}

export default CompleteProfilePage
