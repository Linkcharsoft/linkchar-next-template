import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import EmailValidationPage from '@/screens/auth/EmailValidationPage'

export const metadata: Metadata = {
  title: 'Sign up - Email Validation'
}

interface Props {
  params: Promise<{ email: string }>
}

const Page = async ({ params }: Props) => {
  const { email } = await params

  if(!email) redirect('/login')

  return (
    <EmailValidationPage email={email} />
  )
}

export default Page