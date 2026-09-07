import ExamplePage from '@/screens/ExamplePage/ExamplePage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Example Page'
}

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const Page = async ({ searchParams }: Props) => {
  const params = await searchParams

  return (
    <ExamplePage searchParams={params}/>
  )
}

export default Page