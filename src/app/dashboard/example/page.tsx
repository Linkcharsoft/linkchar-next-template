import ExamplePage from '@/screens/ExamplePage'
import { getServerUser } from '@/utils/auth'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Example Page'
}

const Page = async ({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) => {
  const params = await searchParams
  const user = await getServerUser()

  console.log('User')
  console.table(user)

  return (
    <ExamplePage searchParams={params}/>
  )
}

export default Page