import { redirect } from 'next/navigation'
import SignupConfirmationPage from '@/screens/auth/SignupConfirmationPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up - Confirmation'
}

type Props = {
  params: Promise<{ token: string }>
}

const Page = async ({ params }: Props) => {
  const { token } = await params

  if(!token) redirect('/login')

  return (
    <SignupConfirmationPage token={decodeURIComponent(token)} />
  )
}

export default Page