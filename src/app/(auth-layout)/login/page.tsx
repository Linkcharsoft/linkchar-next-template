import { Metadata } from 'next'
import LoginPage from '@/screens/LoginPage'


export const metadata: Metadata = {
  title: 'Log in'
}

const Page = () => (
  <LoginPage/>
)

export default Page