import PasswordRecoveryPage from '@/screens/auth/PasswordRecoveryPage/PasswordRecoveryPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Password Recovery',
  alternates: {
    canonical: '/password-recovery'
  }
}

const Page = () => (
  <PasswordRecoveryPage />
)

export default Page