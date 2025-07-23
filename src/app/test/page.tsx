import TestPage from '@/screens/TestPage'
import { getServerUser } from '@/utils/auth'

const Page = async () => {
  const user = await getServerUser()

  console.log(user)

  return (
    <TestPage/>
    // <TestPage/>
  )
}

export default Page