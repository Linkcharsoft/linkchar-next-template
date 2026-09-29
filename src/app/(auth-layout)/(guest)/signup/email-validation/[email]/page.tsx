import { redirect } from 'next/navigation'
import EmailValidationPage from '@/screens/auth/EmailValidationPage/EmailValidationPage'
import isValidEmail from '@/utils/isValidEmail'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up - Email Validation'
}

interface Props {
  params: Promise<{ email: string }>
}

const Page = async ({ params }: Props) => {
  const { email } = await params

  const decodedEmail = decodeURIComponent(email)
  if(!email || !isValidEmail(decodedEmail)) redirect('/login')

  return (
    <EmailValidationPage email={decodedEmail} />
  )
}

export default Page