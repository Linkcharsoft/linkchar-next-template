import SentryExamplePage from '@/screens/SentryExamplePage/SentryExamplePage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sentry Example Page',
  description: 'Test Sentry for your Next.js app!'
}

const Page = () => {
  return <SentryExamplePage/>
}

export default Page
