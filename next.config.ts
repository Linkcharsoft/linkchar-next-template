import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

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
    minimumCacheTTL: 31536000,
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' }
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
