'use client'
import { useSession, signOut } from 'next-auth/react'

const Page = () => {
  const { data: session, status } = useSession()

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  console.log(session)
  

  return (
    <div className="flex flex-col gap-4 m-4">
      <div className="flex flex-col gap-2">
        <span className="font-bold">session data:</span>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </div>
      <div className='flex gap-2'>
        <span className='font-bold'>session status</span>
        <span>{status}</span>
      </div>
      <button onClick={handleSignOut}>Cerrar Sesión</button>
    </div>
  )
}

export default Page
