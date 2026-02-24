import ExamplePage from '@/screens/ExamplePage/ExamplePage'
import { getServerUser } from '@/utils/auth'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Example Page'
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams
  const user = await getServerUser()

  console.log('-----  User  -----')
  console.log(user)

  return (
    <ExamplePage searchParams={params}/>
  )
}

export default Page