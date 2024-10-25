import { Metadata } from 'next'
import ChangePasswordConfirmationPage from '@/screens/ChangePasswordConfirmationPage'

export const metadata: Metadata = {
  title: 'Change Password - Confirmation'
}

type Props = {
  params: Promise<{ token: string }>
}

const Page = async ({ params }: Props) => {
  const { token } = await params
  
  return <ChangePasswordConfirmationPage token={token} />
}

export default Page
