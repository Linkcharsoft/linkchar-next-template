import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
  serverExternalPackages: [
    'require-in-the-middle',
    'import-in-the-middle',
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
          // Forces HTTPS for 2 years. Prevents SSL stripping (an attacker on the same network downgrading the user to HTTP).
          // Add `; includeSubDomains` once every subdomain serves valid HTTPS.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // Blocks MIME-sniffing: the browser must trust the Content-Type we send and never "guess" an asset as a script (XSS vector).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Anti-clickjacking: only our own domain can embed the app in an <iframe>.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // When the user follows a link to another domain, send only the origin (not the full URL) to avoid leaking sensitive paths.
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // Disables sensitive browser APIs by default. Remove any feature you need to use (e.g. `geolocation=(self)`).
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
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true
    }
  }
})
