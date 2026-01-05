import SignupPage from '@/screens/auth/SignupPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up'
}

const Page = () => (
  <SignupPage />
)

export default Page