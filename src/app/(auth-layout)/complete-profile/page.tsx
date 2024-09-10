import { Metadata } from 'next'
import CompleteProfilePage from '@/screens/CompleteProfilePage'

export const metadata: Metadata = {
  title: 'Complete Profile'
}

const Page = () => (
  <CompleteProfilePage />
)

export default Page