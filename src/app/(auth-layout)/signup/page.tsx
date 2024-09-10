import { Metadata } from 'next'
import SignupPage from '@/screens/SignupPage'

export const metadata: Metadata = {
  title: 'Sign up'
}

const Page = () => (
  <SignupPage />
)

export default Page