import TestPage from '@/screens/TestPage'
import { getServerUser } from '@/utils/auth'

const Page = async () => {
  const user = await getServerUser()

  return (
    <TestPage user={user}/>
  )
}

export default Page