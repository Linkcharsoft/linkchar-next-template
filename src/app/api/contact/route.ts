import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_FIELDS,
  CONTACT_BRAND,
  CONTACT_FORMS,
  HONEYPOT_FIELD,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
  MAX_FIELD_LENGTH,
  TURNSTILE_FIELD
} from '@/constants/contactForms'
import { CONTACT_FROM, CONTACT_TO, RESEND_API_KEY, TURNSTILE_SECRET_KEY } from '@/constants/env'
import { captureError } from '@/utils/captureError'
import { buildContactEmail } from '@/utils/contactEmail'
import { isValidOrigin } from '@/utils/validateOrigin'
import type { ContactFormDefinitionType, ContactFormIdType } from '@/constants/contactForms'
import type { EmailRowKindType, EmailRowType } from '@/utils/contactEmail'
import type { NextRequest } from 'next/server'

// Deliberately loose: only well-formed enough for Resend to accept as the reply-to, stricter rejects valid addresses.
const IS_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/

// The sandbox sender only delivers to the Resend account owner's address — verify a domain and set CONTACT_FROM for anything else.
const RESEND_FROM = CONTACT_FROM || `${CONTACT_BRAND} <onboarding@resend.dev>`

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const ROW_KINDS: Record<string, EmailRowKindType> = { email: 'email', phone: 'tel', website: 'url' }

// Already rendered in the header or the footer; repeating them as fields is noise.
const HEADER_FIELDS = new Set(['name', 'company', 'origin'])

// Best-effort per-warm-instance limiter: no shared store on Amplify, so it only blunts bursts from one container.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const requestLog = new Map<string, number[]>()

interface AttachmentEntryType {
  file: File
  label: string
}

type FieldReaderType = (name: string) => string

const isRateLimited = (ip: string): boolean => {
  const now = Date.now()

  // Sweeps every key, not just this IP, or entries pile up for the life of the instance.
  for (const [key, times] of requestLog) {
    const fresh = times.filter((time) => now - time < RATE_LIMIT_WINDOW_MS)
    if (fresh.length === 0) requestLog.delete(key)
    else requestLog.set(key, fresh)
  }

  const recent = requestLog.get(ip) ?? []
  recent.push(now)
  requestLog.set(ip, recent)

  return recent.length > RATE_LIMIT_MAX
}

const getClientIp = (request: NextRequest): string =>
  request.headers.get('x-forwarded-for')?.split(',', 1)[0].trim() || 'unknown'

const fail = (message: string, status: number) =>
  NextResponse.json({ success: false, message }, { status })

const hasAllowedExtension = (filename: string): boolean =>
  ATTACHMENT_EXTENSIONS.some((extension) => filename.toLowerCase().endsWith(extension))

const isHumanByTurnstile = async (token: string, ip: string): Promise<boolean> => {
  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip })
  })
  const data = await response.json().catch(() => null) as { success?: boolean } | null

  return Boolean(data?.success)
}

const validateFields = (field: FieldReaderType, definition: ContactFormDefinitionType): string | null => {
  if (definition.required.some((name) => !field(name))) return 'Required fields are missing.'

  // Guards the reply-to: Resend rejects a malformed address and the whole send fails, losing the lead.
  if (!IS_EMAIL.test(field('email'))) return 'The email address is not valid.'

  if (definition.fields.some(([name]) => field(name).length > MAX_FIELD_LENGTH)) return 'One of the fields is too long.'

  return null
}

const collectAttachments = (form: FormData, definition: ContactFormDefinitionType): AttachmentEntryType[] =>
  definition.attachments
    ? ATTACHMENT_FIELDS.flatMap(([name, label]) => {
      const file = form.get(name)
      return file instanceof File && file.size > 0 ? [{ file, label }] : []
    })
    : []

const validateAttachments = (attachments: AttachmentEntryType[]): string | null => {
  if (attachments.some(({ file }) => file.size > MAX_ATTACHMENT_BYTES)) {
    return `Each file must be under ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`
  }

  if (attachments.reduce((total, { file }) => total + file.size, 0) > MAX_ATTACHMENTS_TOTAL_BYTES) {
    return `Attachments exceed ${MAX_ATTACHMENTS_TOTAL_BYTES / 1024 / 1024} MB in total.`
  }

  if (attachments.some(({ file }) => !hasAllowedExtension(file.name))) {
    return 'One of the files has a format that is not allowed.'
  }

  return null
}

export async function POST (request: NextRequest) {
  if (!isValidOrigin(request)) return fail('Forbidden', 403)

  if (!RESEND_API_KEY || !CONTACT_TO) {
    return fail('The contact form is not configured.', 500)
  }

  const ip = getClientIp(request)

  if (isRateLimited(ip)) {
    return fail('Too many messages in a row. Please try again in a few minutes.', 429)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Invalid request.', 400)
  }

  const field: FieldReaderType = (name) => (form.get(name) ?? '').toString().trim()

  // Pretend success so bots don't learn to leave the field empty.
  if (field(HONEYPOT_FIELD)) return NextResponse.json({ success: true })

  if (TURNSTILE_SECRET_KEY) {
    const token = field(TURNSTILE_FIELD)
    if (!token || !(await isHumanByTurnstile(token, ip))) {
      return fail('We could not verify you are human. Please try again.', 400)
    }
  }

  const formId = field('formId') as ContactFormIdType
  const definition: ContactFormDefinitionType | undefined = CONTACT_FORMS[formId]
  if (!definition) return fail('Unknown form.', 400)

  const fieldsError = validateFields(field, definition)
  if (fieldsError) return fail(fieldsError, 400)

  const attachments = collectAttachments(form, definition)
  const attachmentsError = validateAttachments(attachments)
  if (attachmentsError) return fail(attachmentsError, 400)

  const rows = definition.fields
    .filter(([name]) => !HEADER_FIELDS.has(name))
    .map(([name, label]): EmailRowType => [label, field(name) || '—', ROW_KINDS[name]])
  const detail = definition.subjectDetail ? field(definition.subjectDetail) : ''
  const who = field('name') || field('company')
  const subject = [`${definition.label} — ${who}`, detail && `(${detail})`].filter(Boolean).join(' ')
  const email = field('email')

  try {
    const resend = new Resend(RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: CONTACT_TO,
      replyTo: email || undefined,
      subject,
      html: buildContactEmail({
        brand: CONTACT_BRAND,
        kicker: definition.label,
        title: who,
        detail,
        rows,
        attachments: attachments.map(({ file, label }) => `${label}: ${file.name}`),
        origin: field('origin')
      }),
      attachments: await Promise.all(attachments.map(async ({ file }) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer())
      })))
    })

    if (error) {
      captureError('contact-resend', new Error(`${error.name}: ${error.message}`))
      return fail('We could not send your message. Please try again in a few minutes.', 502)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    captureError('contact-send', error)
    return fail('We could not send your message. Please try again in a few minutes.', 502)
  }
}
