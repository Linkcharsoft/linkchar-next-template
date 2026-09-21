export const CONTACT_ENDPOINT = '/api/contact'

// Shown next to the submit button. The server's CONTACT_TO is what actually receives.
export const CONTACT_MAIL = 'hello@example.com'

// Brand name in the email header and the sandbox sender. /init-project renames it.
export const CONTACT_BRAND = 'Linkchar'

// Only bots fill it — see HoneypotField.
export const HONEYPOT_FIELD = 'website'

export const TURNSTILE_FIELD = 'cf-turnstile-response'

// Capped near Amplify's 6 MB Lambda body ceiling, not Resend's 40 MB — raise only after measuring a real upload.
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const MAX_ATTACHMENTS_TOTAL_BYTES = 4 * 1024 * 1024

// The route's own ceiling per text field; Yup bounds it tighter but a direct POST skips that.
export const MAX_FIELD_LENGTH = 2000

export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,image/jpeg,image/png'

// By extension, not MIME: browsers report older Office formats inconsistently, so a MIME allowlist rejects valid uploads.
export const ATTACHMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.jpg', '.jpeg', '.png']

/** `[field name, email label]` — the uploads a form may carry. */
export const ATTACHMENT_FIELDS = [['attachment', 'Attachment']] as const

export type ContactFormIdType = 'contact'

export interface ContactFormDefinitionType {
  /** Names the form in the email subject and heading. */
  label: string
  /** `[field name, email label]` in the order they should appear in the email. */
  fields: readonly (readonly [string, string])[]
  /** Mirrors the client Yup schema's baseline — never trust the browser. */
  required: readonly string[]
  /** Field whose value is appended to the subject, to triage without opening the email. */
  subjectDetail?: string
  attachments?: boolean
}

export const CONTACT_FORMS: Record<ContactFormIdType, ContactFormDefinitionType> = {
  contact: {
    label: 'Contact',
    required: ['name', 'email', 'message'],
    attachments: false,
    fields: [
      ['name', 'Name'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['message', 'Message'],
      ['origin', 'Origin']
    ]
  }
}
