import '@/styles/index.sass'
import 'primeicons/primeicons.css'
import 'primereact/resources/primereact.min.css'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import { Merriweather_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import { APP_ENV, DOMAIN } from '@/constants/env'
import GeneralLayout from '@/layouts/GeneralLayout/GeneralLayout'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

// Variable font — `weight` is omitted on purpose (one .woff2 covers all weights).
// For non-variable fonts, specify only the weights used: `weight: ['400', '700']`.
const merriweatherSans = Merriweather_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-merriweather-sans'
})

// Re-host PrimeIcons font with `display: 'swap'` to fix FOIT.
// The library ships its own @font-face with `font-display: block` which hides icons
// until the font loads (Lighthouse "Ensure text remains visible" fail).
// Pointing `src` at node_modules keeps the file version-locked to package.json —
// `pnpm update primeicons` auto-updates it. The .pi selector override in
// src/styles/index.sass forces the icons to use this variable instead of the
// library's font-family declaration.
const primeIcons = localFont({
  src: '../../node_modules/primeicons/fonts/primeicons.woff2',
  display: 'swap',
  variable: '--font-primeicons',
  preload: true
})

const SITE_URL = new URL(DOMAIN || 'https://linkchar.com')

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
}

export const metadata: Metadata = {
  // General
  metadataBase: SITE_URL,
  applicationName: 'Inferencia Next.js Template',
  generator: 'Next.js',
  title: {
    default: 'Linkchar',
    template: '%s | Linkchar'
  },
  description: 'Inferencia Next.js Template - Created by Inferencia AI Solutions',
  referrer: 'origin-when-cross-origin',
  category: 'Software Development',

  // Authors
  authors: [
    { name: 'Inferencia AI Solutions', url: 'https://www.linkedin.com/company/inferencia-ai/posts/' },
    { name: 'Lucas Ojeda De Sousa (Lukway)', url: 'https://www.linkedin.com/in/lukway/' },
    { name: 'Lucas Ezequiel Pereyra', url: 'https://www.linkedin.com/in/lucas-pereyra-dw/' }
    // { name: 'Luca Cittá Giordano', url: 'https://www.linkedin.com/in/lucacittagiordano/' },
    // { name: 'Francesco Silvetti', url: 'https://www.linkedin.com/in/francescosilvetti/' },
    // { name: 'Melanie Cavanna', url: 'https://www.linkedin.com/in/melanie-cavanna-921716170/' },
    // { name: 'Mariana Sofía Ulloque', url: 'https://www.linkedin.com/in/mariana-sof%C3%ADa-ulloque-6129bb13a/' }
  ],
  creator: 'Inferencia AI Solutions',
  publisher: 'Inferencia - Next.js Template',

  // URLs & alternates
  manifest: '/manifest.json',
  alternates: {
    canonical: '/'
    // languages: {
    //   'en-US': '/en/',
    //   'es-AR': '/es/
    // }
  },

  // SEO
  keywords: ['Inferencia'],
  openGraph: {
    title: 'Inferencia AI Solutions',
    description: 'Next.js Template',
    url: '/',
    type: 'website',
    siteName: 'Inferencia AI Solutions',
    images: [
      {
        url: '/seo/social-banner.webp',
        width: 1200,
        height: 630,
        alt: 'Inferencia AI Solutions'
      }
    ],
    locale: 'en_US'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inferencia AI Solutions',
    description: 'Next.js Template',
    creator: '@linkchar',
    images: {
      url: '/seo/social-banner.webp',
      alt: 'Inferencia AI Solutions'
    }
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },

  // Icons
  icons: {
    icon: [
      { url: '/seo/favicon.ico', sizes: 'any', type: 'image/x-ico' }, // https://convertico.com/
      { url: '/seo/favicon16.png', sizes: '16x16', type: 'image/png' },
      { url: '/seo/favicon32.png', sizes: '32x32', type: 'image/png' },
      { url: '/seo/favicon48.png', sizes: '48x48', type: 'image/png' },
      { url: '/seo/favicon144.png', sizes: '144x144', type: 'image/png' },
      { url: '/seo/favicon180.png', sizes: '180x180', type: 'image/png' },
      { url: '/seo/favicon192.png', sizes: '192x192', type: 'image/png' },
      { url: '/seo/favicon512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: {
      url: '/seo/favicon144.png',
      sizes: '144x144',
      type: 'image/png'
    },
    apple: [
      { url: '/seo/favicon180.png', sizes: '180x180', type: 'image/png' }
    ],
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/seo/favicon144.png',
      sizes: '144x144',
      type: 'image/png'
    }
  },
  // Verification
  verification: {
    // google: 'google', // Replace with verifitation token
    // yandex: 'yandex', // Replace with verifitation tokens
    // yahoo: 'yahoo', // Replace with verifitation tokens
    other: {
      me: ['hola@inferencia.io', 'https://inferencia.io']
    }
  },
  // Apple
  appleWebApp: {
    title: 'Inferencia - Next.js Template',
    statusBarStyle: 'black-translucent',
    startupImage: ['/seo/splash.webp']
  },
  // Extras
  bookmarks: [SITE_URL.href]
}

interface Props {
  children: ReactNode
}

const Layout = async ({ children }: Props) => (
  <html lang="en" className={`${merriweatherSans.variable} ${primeIcons.variable}`}>
    <head>
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

      {APP_ENV === 'development' && (
        <Script
          src="//unpkg.com/react-scan/dist/auto.global.js"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
      )}
    </head>
    <body>
      <GeneralLayout>{ children }</GeneralLayout>
    </body>
  </html>
)

export default Layout