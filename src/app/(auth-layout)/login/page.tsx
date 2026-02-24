import LoginPage from '@/screens/auth/LoginPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log in',
  alternates: {
    canonical: '/login'
  }
}

const Page = () => (
  <LoginPage/>
)

export default Page