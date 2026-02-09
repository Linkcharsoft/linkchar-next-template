import { redirect } from 'next/navigation'
import PasswordRecoveryConfirmationPage from '@/screens/auth/PasswordRecoveryConfirmationPage'
import validateEmail from '@/utils/validateEmail'
import type { Metadata } from 'next'

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

  const decodedEmail = decodeURIComponent(email)
  if(!token || !email || !validateEmail(decodedEmail)) redirect('/login')

  return (
    <PasswordRecoveryConfirmationPage token={decodeURIComponent(token)} email={decodedEmail} />
  )
}

export default Page