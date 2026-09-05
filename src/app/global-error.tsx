'use client'
import '@/styles/index.sass'
import GlobalErrorPage from '@/screens/GlobalErrorPage/GlobalErrorPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Error 😱'
}

export default function GlobalError ({
  error
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body>
        <GlobalErrorPage error={error}/>
      </body>
    </html>
  )
}
