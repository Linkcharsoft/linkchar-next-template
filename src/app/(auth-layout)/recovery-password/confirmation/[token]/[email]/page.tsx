import { Metadata } from 'next'
import RecoveryPasswordConfirmationPage from '@/screens/RecoveryPasswordConfirmationPage'

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
    <RecoveryPasswordConfirmationPage token={token} email={email} />
  )
}

export default Page