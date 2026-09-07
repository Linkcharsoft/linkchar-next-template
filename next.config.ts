import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

// Report-Only: violations are reported (console + Sentry when DSN is set), nothing is blocked.
// 'unsafe-inline' documents today's reality (Next's hydration scripts are inline); nonces are the tightening path.
const toOrigin = (value?: string): string | undefined => {
  try { return value ? new URL(value).origin : undefined } catch { return undefined }
}

const buildCspReportOnly = (): string => {
  const isDev = process.env.NODE_ENV !== 'production'
  const apiOrigin = toOrigin(process.env.NEXT_PUBLIC_API_URL)
  const clarity = Boolean(process.env.NEXT_PUBLIC_CLARITY_ID)

  let reportUri: string | undefined
  try {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      const { host, pathname, username } = new URL(dsn)
      reportUri = `https://${host}/api${pathname}/security/?sentry_key=${username}`
    }
  } catch { /* malformed DSN — report endpoint skipped, policy still emitted */ }

  const scriptSrc = ['\'self\'', '\'unsafe-inline\'', 'https://browser.sentry-cdn.com']
  if (clarity) scriptSrc.push('https://www.clarity.ms')
  if (isDev) scriptSrc.push('https://unpkg.com')

  const connectSrc = ['\'self\'', 'https://*.ingest.sentry.io', 'https://*.ingest.us.sentry.io']
  if (apiOrigin) connectSrc.push(apiOrigin)
  if (clarity) connectSrc.push('https://*.clarity.ms')
  if (isDev) connectSrc.push('ws:')

  return [
    'default-src \'self\'',
    `script-src ${scriptSrc.join(' ')}`,
    'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com',
    'img-src \'self\' data: blob:',
    'font-src \'self\' data: https://fonts.gstatic.com',
    `connect-src ${connectSrc.join(' ')}`,
    'worker-src \'self\' blob:',
    'object-src \'none\'',
    'base-uri \'self\'',
    'form-action \'self\'',
    'frame-ancestors \'self\'',
    ...(reportUri ? [`report-uri ${reportUri}`] : [])
  ].join('; ')
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: [
    '@sentry/nextjs',
    '@sentry/node',
    '@sentry/core',
    'require-in-the-middle',
    '@opentelemetry/instrumentation'
  ],
  compiler: {
    // Keep error/warn in production.
    removeConsole: (process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NODE_ENV === 'production')
      ? { exclude: ['error', 'warn'] }
      : false
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  sassOptions: {
    additionalData: `
      @use "@/styles/mixins.sass" as mixins;
    `
  },

  images: {
    minimumCacheTTL: 31_536_000,
    formats: ['image/avif', 'image/webp']
    // Add per-project when loading images from external origins (CDN, CMS, S3, etc.):
    // remotePatterns: [
    //   { protocol: 'https', hostname: new URL(process.env.NEXT_PUBLIC_MEDIA_URL).host, pathname: '/**' }
    // ]
  },

  async headers () {
    return [
      {
        source: '/:path*',
        headers: [
          // Force HTTPS 2y (anti SSL-stripping); add `; includeSubDomains` when all subdomains are HTTPS
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // Block MIME-sniffing (asset-as-script XSS vector)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Anti-clickjacking: only our own domain may iframe the app
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Cross-domain navigations leak only the origin, not the full path
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // Disable sensitive APIs by default; re-enable per feature (e.g. `geolocation=(self)`)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // Observe-first CSP — switch the key to Content-Security-Policy once reports come back clean
          { key: 'Content-Security-Policy-Report-Only', value: buildCspReportOnly() }
        ]
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }
        ]
      },
      {
        source: '/seo/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }
        ]
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' }
        ]
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' }
        ]
      }
    ]
  }

  // --- ⚠️ Don't use in production ⚠️ ---
  // experimental: {
  //   optimizePackageImports: ['primereact', 'primeicons', 'three', 'framer-motion'],
  //   turbopackFileSystemCacheForDev: true,
  //   cssChunking: true,
  //   inlineCss: true,
  //   webVitalsAttribution: ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']
  // }
}

export default withSentryConfig(nextConfig, {
  // Options: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  // Wider source maps for readable stack traces (slower builds)
  widenClientFileUpload: true,

  // Tunnels browser→Sentry requests to dodge ad-blockers (adds server load)
  tunnelRoute: '/monitoring'

  // No `webpack` block: its options are a no-op under Turbopack (Next 16 default build)
})
