import { Metadata } from 'next'
import PasswordRecoveryConfirmationPage from '@/screens/auth/PasswordRecoveryConfirmationPage'

export const metadata: Metadata = {
  title: 'Password Recovery - Confirmation'
}

interface Props {
  params: Promise<{
    token: string
    email: string
  }>
}

const Page = async ({ params }: Props) => {
  const { token, email } = await params
  return (
    <PasswordRecoveryConfirmationPage token={token} email={email} />
  )
}

export default Page