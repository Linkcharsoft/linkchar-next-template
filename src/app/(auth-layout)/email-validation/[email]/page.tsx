import { Metadata } from 'next'
import EmailValidationPage from '@/screens/EmailValidationPage'

export const metadata: Metadata = {
  title: 'Email Validation'
}

type Props = {
  params: {
    email: string
  }
}

const Page = ({ params: { email } }: Props) => (
  <EmailValidationPage email={email} />
)

export default Page