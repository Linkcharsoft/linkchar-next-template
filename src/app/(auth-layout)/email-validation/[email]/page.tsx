import { Metadata } from 'next'
import EmailValidationPage from '@/screens/EmailValidationPage'

export const metadata: Metadata = {
  title: 'Email Validation'
}

type Props = {
  params: Promise<{ email: string }>
}

const Page = async ({ params }: Props) => {
  const { email } = await params
  return <EmailValidationPage email={email} />
}

export default Page
