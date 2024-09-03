import { Metadata } from 'next'
import RecoveryPasswordConfirmationPage from '@/screens/RecoveryPasswordConfirmationPage'

export const metadata: Metadata = {
  title: 'Password Recovery - Confirmation'
}

type Props = {
  params: {
    token: string
    email: string
  }
}

const Page = ({ params: { token, email } }: Props) => (
  <RecoveryPasswordConfirmationPage token={token} email={email} />
)

export default Page