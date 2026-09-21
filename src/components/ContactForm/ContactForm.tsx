'use client'
import './ContactForm.sass'
import { useFormik } from 'formik'
import { FileUpload } from 'primereact/fileupload'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { useState } from 'react'
import * as Yup from 'yup'
import CustomButton from '@/components/CustomButton/CustomButton'
import HoneypotField from '@/components/inputs/HoneypotField/HoneypotField'
import InputContainer from '@/components/inputs/InputContainer/InputContainer'
import TurnstileWidget from '@/components/inputs/TurnstileWidget/TurnstileWidget'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_FIELDS,
  CONTACT_FORMS,
  CONTACT_MAIL,
  MAX_ATTACHMENT_BYTES
} from '@/constants/contactForms'
import useContactForm from '@/hooks/useContactForm'
import type { ContactFileEntryType } from '@/hooks/useContactForm'
import type { FileUploadHandlerEvent } from 'primereact/fileupload'
import type { FormEvent, ReactNode } from 'react'

// Reference contact form. Ships UNMOUNTED — a project mounts it in a screen or modal and adapts fields, copy and language.

interface Props {
  className?: string
}

interface ContactFormType {
  name: string
  email: string
  phone: string
  message: string
  attachment: string
}

type AttachmentFieldType = (typeof ATTACHMENT_FIELDS)[number][0]

const FORM_ID = 'contact'
const DEFINITION = CONTACT_FORMS[FORM_ID]

const REQUIRED = 'Required'
const INVALID_EMAIL = 'Invalid email'
const INVALID_PHONE = 'Invalid phone number'
const TOO_SHORT = 'Too short'
const tooLong = (max: number) => `Maximum ${max} characters`

const FIELD_MAX = {
  name: 80,
  email: 120,
  phone: 20,
  message: 1000
}

// Permissive on purpose: accepts the shapes people actually type; only the digit count is enforced (E.164's 15-digit ceiling).
const isPhone = (value?: string): boolean => {
  if (!value) return true
  const digits = value.replaceAll(/\D/g, '').length
  return /^[\d\s+()-]+$/.test(value) && digits >= 8 && digits <= 15
}

const SCHEMA = Yup.object({
  name: Yup.string().trim().min(2, TOO_SHORT).max(FIELD_MAX.name, tooLong(FIELD_MAX.name)).required(REQUIRED),
  email: Yup.string().trim().email(INVALID_EMAIL).max(FIELD_MAX.email, tooLong(FIELD_MAX.email)).required(REQUIRED),
  phone: Yup.string().trim().max(FIELD_MAX.phone, tooLong(FIELD_MAX.phone)).test('phone', INVALID_PHONE, isPhone),
  message: Yup.string().trim().max(FIELD_MAX.message, tooLong(FIELD_MAX.message)).required(REQUIRED),
  attachment: DEFINITION.attachments ? Yup.string().required(REQUIRED) : Yup.string()
})

const INITIAL_VALUES: ContactFormType = {
  name: '',
  email: '',
  phone: '',
  message: '',
  attachment: ''
}

const FieldLabel = ({ children, required }: { children: ReactNode, required?: boolean }) => (
  <span>
    { children }
    {required && (
      <>
        {' '}
        <span aria-hidden='true' className='ContactForm__Required'>*</span>
        <span className='sr-only'>(required)</span>
      </>
    )}
  </span>
)

const ContactForm = ({ className }: Props) => {
  const [sent, setSent] = useState(false)
  const [files, setFiles] = useState<Partial<Record<AttachmentFieldType, File>>>({})
  const [attempt, setAttempt] = useState(0)
  const { errorMessage, isSubmitting, submit, honeypotProps, turnstileProps } = useContactForm(FORM_ID)

  const formik = useFormik<ContactFormType>({
    initialValues: INITIAL_VALUES,
    validationSchema: SCHEMA,
    validateOnChange: false,
    onSubmit: async (values) => {
      const uploads = ATTACHMENT_FIELDS.flatMap<ContactFileEntryType>(([name]) => {
        const file = files[name]
        return file ? [[name, file]] : []
      })

      // Attachments live in Formik only as filenames; the real File objects must not be sent twice under those names.
      const isAttachment = (field: string) => ATTACHMENT_FIELDS.some(([name]) => name === field)
      const payload = Object.fromEntries(Object.entries(values).filter(([field]) => !isAttachment(field)))

      if (await submit(payload, DEFINITION.attachments ? uploads : [])) setSent(true)
      // A Turnstile token is single-use: remount the widget so a retry gets a fresh one.
      else setAttempt((current) => current + 1)
    }
  })

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    const errors = await formik.validateForm()
    const invalidFields = Object.keys(errors)

    if (invalidFields.length > 0) {
      await formik.setTouched(Object.fromEntries(invalidFields.map((field) => [field, true])))
      document.getElementById(invalidFields[0])?.focus()
      return
    }

    formik.handleSubmit()
  }

  const handleFile = (field: AttachmentFieldType) => (e: FileUploadHandlerEvent) => {
    const file = e.files[0]

    setFiles((current) => ({ ...current, [field]: file }))
    void formik.setFieldValue(field, file?.name ?? '')
    e.options.clear()
  }

  const { values, errors } = formik

  if (sent) {
    return (
      <div className={`ContactForm__Done ${className ?? ''}`} role='status'>
        <p className='ContactForm__DoneTitle'>Thanks for reaching out.</p>
        <p className='ContactForm__DoneText'>We received your message and will get back to you soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} noValidate className={`ContactForm ${className ?? ''}`}>
      <HoneypotField id='contact-website' {...honeypotProps}/>

      <div className='ContactForm__Fields'>
        <div className='ContactForm__Pair'>
          <InputContainer label={<FieldLabel required>Name</FieldLabel>} htmlFor='name' error={errors.name}>
            <InputText
              id='name'
              name='name'
              value={values.name}
              maxLength={FIELD_MAX.name}
              onChange={formik.handleChange}
              autoComplete='name'
              invalid={Boolean(errors.name)}
              disabled={isSubmitting}
            />
          </InputContainer>

          <InputContainer label={<FieldLabel required>Email</FieldLabel>} htmlFor='email' error={errors.email}>
            <InputText
              id='email'
              name='email'
              type='email'
              inputMode='email'
              value={values.email}
              maxLength={FIELD_MAX.email}
              onChange={formik.handleChange}
              autoComplete='email'
              invalid={Boolean(errors.email)}
              disabled={isSubmitting}
            />
          </InputContainer>
        </div>

        <InputContainer label={<FieldLabel>Phone (optional)</FieldLabel>} htmlFor='phone' error={errors.phone}>
          <InputText
            id='phone'
            name='phone'
            type='tel'
            inputMode='tel'
            value={values.phone}
            maxLength={FIELD_MAX.phone}
            onChange={formik.handleChange}
            autoComplete='tel'
            invalid={Boolean(errors.phone)}
            disabled={isSubmitting}
          />
        </InputContainer>

        <InputContainer label={<FieldLabel required>Message</FieldLabel>} htmlFor='message' error={errors.message}>
          <InputTextarea
            id='message'
            name='message'
            rows={5}
            value={values.message}
            maxLength={FIELD_MAX.message}
            onChange={formik.handleChange}
            autoResize
            invalid={Boolean(errors.message)}
            disabled={isSubmitting}
          />
        </InputContainer>

        {DEFINITION.attachments && (
          <InputContainer label={<FieldLabel required>Attachment</FieldLabel>} htmlFor='attachment' error={errors.attachment}>
            <FileUpload
              mode='basic'
              name='attachment'
              accept={ATTACHMENT_ACCEPT}
              maxFileSize={MAX_ATTACHMENT_BYTES}
              customUpload
              auto
              uploadHandler={handleFile('attachment')}
              chooseLabel={values.attachment || 'Attach a file'}
              invalidFileSizeMessageSummary='{0}: invalid file size.'
              invalidFileSizeMessageDetail='The maximum size is {0}.'
              disabled={isSubmitting}
            />
          </InputContainer>
        )}
      </div>

      <TurnstileWidget key={attempt} {...turnstileProps}/>

      {errorMessage && (
        <p role='alert' className='ContactForm__Error'>{ errorMessage }</p>
      )}

      <div className='ContactForm__Actions'>
        <CustomButton type='submit' loading={isSubmitting} disabled={isSubmitting} aria-disabled={isSubmitting}>
          Send message
        </CustomButton>

        <a href={`mailto:${CONTACT_MAIL}`} className='ContactForm__Mail'>or write to us at { CONTACT_MAIL }</a>
      </div>
    </form>
  )
}

export default ContactForm
