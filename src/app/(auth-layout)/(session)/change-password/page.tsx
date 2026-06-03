import ChangePasswordPage from '@/screens/auth/ChangePasswordPage/ChangePasswordPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Change Password',
  alternates: {
    canonical: '/change-password'
  }
}

const Page = () => (
  <ChangePasswordPage/>
)

export default Page