'use client'
import '@/styles/index.sass'
import GlobalErrorPage from '@/screens/GlobalErrorPage/GlobalErrorPage'
import type { CSSProperties } from 'react'

// No next/font here — breaks every route in dev under reactCompiler (CONVENTIONS > Font Loading); <link> + inline var instead.
const FONT_VARIABLES = { '--font-merriweather-sans': '\'Merriweather Sans\'' } as CSSProperties

export default function GlobalError ({
  error
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en" style={FONT_VARIABLES}>
      <head>
        <title>Error 😱</title>
        <link rel='preconnect' href='https://fonts.googleapis.com'/>
        <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin=''/>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- global-error has no layout to inherit next/font from */}
        <link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Merriweather+Sans:wght@400;700&display=swap'/>
      </head>
      <body>
        <GlobalErrorPage error={error}/>
      </body>
    </html>
  )
}
