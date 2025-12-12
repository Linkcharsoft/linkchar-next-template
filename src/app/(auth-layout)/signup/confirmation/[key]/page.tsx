import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SignupConfirmationPage from '@/screens/auth/SignupConfirmationPage'

export const metadata: Metadata = {
  title: 'Sign up - Confirmation'
}

type Props = {
  params: Promise<{ key: string }>
}

const Page = async ({ params }: Props) => {
  const { key } = await params

  if(!key) redirect('/login')

  return (
    <SignupConfirmationPage key={decodeURIComponent(key)} />
  )
}

export default Page