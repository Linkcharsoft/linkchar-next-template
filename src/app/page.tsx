import { Metadata } from 'next'
import HomePage from '@/screens/HomePage'

export const metadata: Metadata = {
  title: 'Home'
}

const Page = () => (
  <HomePage/>
)

export default Page