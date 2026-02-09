import { AUTH_EMAIL_SUBJECTS } from '@/constants/auth'
import type { Email } from 'mailslurp-client'

const extractValidationCodeFromEmail = (email: Email): string => {
  expect(email.subject).to.include(AUTH_EMAIL_SUBJECTS['verify-email'])

  const parser = new DOMParser()
  const doc = parser.parseFromString(email.body as string, 'text/html')

  const link = doc.querySelector('a')?.getAttribute('href')
  if (!link) throw new Error('No link found')

  const linkParts = link.split('/')
  const code = linkParts[linkParts.length - 2]

  return code
}

export default extractValidationCodeFromEmail