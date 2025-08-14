import { Metadata } from 'next'
import PasswordRecoveryPage from '@/screens/auth/PasswordRecoveryPage'

export const metadata: Metadata = {
  title: 'Password Recovery'
}

const Page = () => (
  <PasswordRecoveryPage />
)

export default Page