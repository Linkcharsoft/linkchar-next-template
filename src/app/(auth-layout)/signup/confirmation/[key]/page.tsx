import SignupConfirmationPage from '@/screens/SignupConfirmationPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up - Confirmation'
}

type Props = {
  params: Promise<{ key: string }>
}

const Page = async ({ params }: Props) => {
  const { key } = await params
  return <SignupConfirmationPage confirmationKey={key} />
}

export default Page
