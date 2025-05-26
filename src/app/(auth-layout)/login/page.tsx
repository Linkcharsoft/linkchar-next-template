import { Metadata } from 'next'
import LoginPage from '@/screens/auth/LoginPage'


export const metadata: Metadata = {
  title: 'Log in'
}

const Page = () => (
  <LoginPage/>
)

export default Page