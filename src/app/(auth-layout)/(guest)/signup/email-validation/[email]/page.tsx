import { redirect } from 'next/navigation'
import EmailValidationPage from '@/screens/auth/EmailValidationPage/EmailValidationPage'
import validateEmail from '@/utils/validateEmail'
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
  if(!email || !validateEmail(decodedEmail)) redirect('/login')

  return (
    <EmailValidationPage email={decodedEmail} />
  )
}

export default Page