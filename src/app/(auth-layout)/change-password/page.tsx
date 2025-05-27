import { Metadata } from 'next'
import ChangePasswordPage from '@/screens/auth/ChangePasswordPage'

export const metadata: Metadata = {
  title: 'Change Password'
}

const Page = () => (
  <ChangePasswordPage/>
)

export default Page