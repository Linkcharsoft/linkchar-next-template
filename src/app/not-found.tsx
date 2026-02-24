import NotFoundPage from '@/screens/NotFoundPage/NotFoundPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found 🤔'
}

const Page = () => {
  return <NotFoundPage/>
}

export default Page