import PasswordRecoveryPage from '@/screens/auth/PasswordRecoveryPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Password Recovery'
}

const Page = () => (
  <PasswordRecoveryPage />
)

export default Page