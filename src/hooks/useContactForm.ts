'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  CONTACT_ENDPOINT,
  HONEYPOT_FIELD,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
  TURNSTILE_FIELD
} from '@/constants/contactForms'
import type { ContactFormIdType } from '@/constants/contactForms'
import type { ChangeEvent } from 'react'

// Shared submit lifecycle for every contact form; each form still owns its fields, Formik schema and markup.

export type ContactStatusType = 'idle' | 'submitting' | 'success' | 'error'

const GENERIC_ERROR = 'We could not send your message. Check your connection and try again.'

const megabytes = (bytes: number) => bytes / 1024 / 1024

/** Where the form was filled in, so a lead can be traced back to its page. */
const buildOrigin = (pathname: string): string => [document.title, pathname].filter(Boolean).join(' · ')

/** `[form field name, file]` — the route reads each upload from its own field. */
export type ContactFileEntryType = readonly [string, File]

const useContactForm = (formId: ContactFormIdType) => {
  const pathname = usePathname()
  const [status, setStatus] = useState<ContactStatusType>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const failWith = (message: string) => {
    setErrorMessage(message)
    setStatus('error')
    return false
  }

  /** Resolves `true` when the message was sent, so the caller can switch to its done state. */
  const submit = async (values: object, files: ContactFileEntryType[] = []): Promise<boolean> => {
    setStatus('submitting')
    setErrorMessage(null)

    if (files.some(([, file]) => file.size > MAX_ATTACHMENT_BYTES)) {
      return failWith(`Each file must be under ${megabytes(MAX_ATTACHMENT_BYTES)} MB.`)
    }

    if (files.reduce((total, [, file]) => total + file.size, 0) > MAX_ATTACHMENTS_TOTAL_BYTES) {
      return failWith(`Attachments exceed ${megabytes(MAX_ATTACHMENTS_TOTAL_BYTES)} MB in total.`)
    }

    const body = new FormData()
    body.append('formId', formId)
    body.append(HONEYPOT_FIELD, honeypot)
    body.append('origin', buildOrigin(pathname))
    if (turnstileToken) body.append(TURNSTILE_FIELD, turnstileToken)

    for (const [name, value] of Object.entries(values)) {
      if (typeof value === 'string' || typeof value === 'number') body.append(name, String(value))
    }

    for (const [name, file] of files) body.append(name, file, file.name)

    try {
      const response = await fetch(CONTACT_ENDPOINT, { method: 'POST', body })
      const data = await response.json().catch(() => null) as { success?: boolean, message?: string } | null

      if (!response.ok || !data?.success) return failWith(data?.message || GENERIC_ERROR)

      setStatus('success')
      setHoneypot('')
      return true
    } catch {
      return failWith(GENERIC_ERROR)
    }
  }

  return {
    status,
    errorMessage,
    isSubmitting: status === 'submitting',
    submit,
    honeypotProps: {
      value: honeypot,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setHoneypot(event.target.value)
    },
    turnstileProps: {
      onToken: setTurnstileToken
    }
  }
}

export default useContactForm
