import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  typedRoutes: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  }

  // --- Images config example ---
  // images: {
  //   minimumCacheTTL: 3600,
  //   formats: ['image/avif', 'image/webp'],
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.NEXT_PUBLIC_MEDIA_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     },
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.STRAPI_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     },
  //     {
  //       protocol: 'https',
  //       hostname: new URL(process.env.STRAPI_MEDIA_URL).host,
  //       port: '',
  //       pathname: '/**',
  //     }
  //   ]
  // }

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

  org: 'linkchar-y5',

  project: 'test-next-16',

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
