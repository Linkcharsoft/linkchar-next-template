import SignupConfirmationPage from '@/screens/SignupConfirmationPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up - Confirmation'
}

type Props = {
  params: {
    key: string
  }
}

const Page = ({ params: { key } }: Props) => (
  <SignupConfirmationPage confirmationKey ={key} />
)

export default Page