'use client'
import { Session } from 'next-auth'
import { getSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

const Page = () => {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const handleGetSession = async () => {
      const session = await getSession()
      setSession(session || null)
    }
    handleGetSession()
  }, [])

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="flex flex-col gap-4 m-4">
      <div className="flex flex-col gap-2">
        <span className="font-bold">session data:</span>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </div>
      <button onClick={handleSignOut}>Cerrar Sesión</button>
    </div>
  )
}

export default Page
