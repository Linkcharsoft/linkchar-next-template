import './GeneralLayout.sass'
import Head from 'next/head'
import ProvidersContainer from '@/providers/ProvidersContainer'
import { getAccessToken, getServerUser } from '@/utils/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

const GeneralLayout = async ({ children }: Props) => {
  let token
  let user

  try {
    token = await getAccessToken()
    user = await getServerUser()
  } catch (error) {
    console.error(error)
  }

  return (
    <html lang="en">
      <Head>
        {/* Tailwind */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const style = document.createElement('style')
              style.innerHTML = '@layer tailwind-base, primereact, tailwind-utilities;'
              style.setAttribute('type', 'text/css')
              document.querySelector('head').prepend(style)
            `
          }}
        />
      </Head>
      <body>
        <ProvidersContainer token={token} user={user}>
          { children }
        </ProvidersContainer>
      </body>
    </html>
  )
}


export default GeneralLayout