import SignupPage from '@/screens/auth/SignupPage/SignupPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign up',
  alternates: {
    canonical: '/signup'
  }
}

const Page = () => (
  <SignupPage />
)

export default Page