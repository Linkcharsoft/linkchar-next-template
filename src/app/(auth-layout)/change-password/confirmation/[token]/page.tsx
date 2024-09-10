import { Metadata } from 'next'
import ChangePasswordConfirmationPage from '@/screens/ChangePasswordConfirmationPage'

export const metadata: Metadata = {
  title: 'Change Password - Confirmation'
}

type Props = {
  params: {
    token: string
  }
}

const Page = ({ params: { token } }: Props) => (
  <ChangePasswordConfirmationPage token={token} />
)

export default Page