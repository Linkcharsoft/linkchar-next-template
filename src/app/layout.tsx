import { Metadata } from 'next'


import '@/styles/index.sass'


export const metadata: Metadata = {
  // General
  metadataBase: new URL('https://linkchar.com'), // Replace with an env variable with proyect domain
  applicationName: 'Linkchar Next Template',
  generator: 'Next.js',
  title: {
    default: 'Linkchar',
    template: '%s | Linkchar',
  },
  description: 'Linkchar Next Template - Created by Lucas Ojeda De Sousa (Lukway)',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  referrer: 'origin-when-cross-origin',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  category: 'Software Development',
  // Author
  // Add all team members
  authors: [{ name: 'Lucas Ojeda De Sousa (Lukway)', url: 'lukway.dev@gmail.com' }],
  creator: 'Lucas Ojeda De Sousa (Lukway)',
  publisher: 'Linkchar - Next Template',
  // URL
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
    },
  },
  // SEO
  keywords: ['Linkchar'],
  openGraph: {
    title: 'Linkchar',
    description: 'Generated by create next app',
    url: 'http://localhost:3000',
    type: 'book',
    siteName: 'Linkchar Software Development',
    images: [
      {
        url: 'https://linkchar-static-bk.s3.amazonaws.com/static/img/seo/seo.jpg',
        width: 800,
        height: 465,
      },
      {
        url: 'https://linkchar-static-bk.s3.amazonaws.com/static/img/seo/seo.jpg',
        width: 1400,
        height: 810,
        alt: 'My custom alt',
      },
    ],
    locale: 'en_US',
    authors: ['Lucas Ojeda De Sousa (Lukway)'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Linkchar - Next Template',
    description: 'Linkchar - Next Template',
    siteId: '123456789',
    creator: '@linkchar',
    creatorId: '123456789',
    images: {
      url: 'https://linkchar-static-bk.s3.amazonaws.com/static/img/seo/seo.jpg',
      alt: 'Linkchar',
    }
  },
  // Robots
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-ico' },
      { url: '/favicon16.ico', sizes: '16x16', type: 'image/x-ico' },
      { url: '/favicon32.ico', sizes: '32x32', type: 'image/x-ico' },
      { url: '/favicon36.ico', sizes: '36x36', type: 'image/x-ico' },
      { url: '/favicon48.ico', sizes: '48x48', type: 'image/x-ico' },
      { url: '/favicon57.ico', sizes: '57x57', type: 'image/x-ico' },
      { url: '/favicon60.ico', sizes: '60x60', type: 'image/x-ico' },
      { url: '/favicon72.ico', sizes: '72x72', type: 'image/x-ico' },
      { url: '/favicon76.ico', sizes: '76x76', type: 'image/x-ico' },
      { url: '/favicon96.ico', sizes: '96x96', type: 'image/x-ico' },
      { url: '/favicon114.ico', sizes: '114x114', type: 'image/x-ico' },
      { url: '/favicon120.ico', sizes: '120x120', type: 'image/x-ico' },
      { url: '/favicon128.ico', sizes: '128x128', type: 'image/x-ico' },
      { url: '/favicon144.ico', sizes: '144x144', type: 'image/x-ico' },
      { url: '/favicon152.ico', sizes: '152x152', type: 'image/x-ico' },
      { url: '/favicon180.ico', sizes: '180x180', type: 'image/x-ico' },
      { url: '/favicon192.ico', sizes: '192x192', type: 'image/x-ico' },
      { url: '/favicon256.ico', sizes: '256x256', type: 'image/x-ico' },
      { url: '/favicon512.ico', sizes: '512x512', type: 'image/x-ico' },
    ],
    shortcut: {
      url: '/favicon144.ico',
      sizes: '144x144',
      type: 'image/x-ico'
    },
    apple: [
      { url: '/favicon57.ico', sizes: '57x57', type: 'image/x-ico' },
      { url: '/favicon60.ico', sizes: '60x60', type: 'image/x-ico' },
      { url: '/favicon72.ico', sizes: '72x72', type: 'image/x-ico' },
      { url: '/favicon76.ico', sizes: '76x76', type: 'image/x-ico' },
      { url: '/favicon114.ico', sizes: '114x114', type: 'image/x-ico' },
      { url: '/favicon120.ico', sizes: '120x120', type: 'image/x-ico' },
      { url: '/favicon144.ico', sizes: '144x144', type: 'image/x-ico' },
      { url: '/favicon152.ico', sizes: '152x152', type: 'image/x-ico' },
      { url: '/favicon180.ico', sizes: '180x180', type: 'image/x-ico' },
    ],
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/favicon144.ico',
      sizes: '144x144',
      type: 'image/x-ico'
    },
  },
  // Verification
  verification: {
    google: 'google',
    yandex: 'yandex',
    yahoo: 'yahoo',
    other: {
      me: ['contact@linkchar.com', 'https://linkchar.com'],
    },
  },
  // Apple
  appleWebApp: {
    title: 'Linkchar',
    statusBarStyle: 'black-translucent',
    startupImage: [
      '/splash.png'
    ],
  },
  // Extras
  bookmarks: ['https://linkchar.com']
}

interface Props {
  children: React.ReactNode
}
export default function Layout({ children }: Props) {
  return (
    <html lang="en">
      <body>
        <h1>Layout</h1>
        { children }
        >
        >
        >
        >
        >
        >
        >
      </body>
    </html>
  )
}
