import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import ChangePasswordConfirmationPage from '@/screens/auth/ChangePasswordConfirmationPage'

export const metadata: Metadata = {
  title: 'Change Password - Confirmation'
}

interface Props {
  params: Promise<{ token: string }>
}

const Page = async ({ params }: Props) => {
  const { token } = await params

  if(!token) redirect('/')

  return (
    <ChangePasswordConfirmationPage token={decodeURIComponent(token)} />
  )
}

export default Page