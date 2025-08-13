import { Metadata } from 'next'
import SignupConfirmationPage from '@/screens/auth/SignupConfirmationPage'

export const metadata: Metadata = {
  title: 'Sign up - Confirmation'
}

type Props = {
  params: Promise<{ token: string }>
}

const Page = async ({ params }: Props) => {
  const { token } = await params

  return (
    <SignupConfirmationPage token={token} />
  )
}

export default Page