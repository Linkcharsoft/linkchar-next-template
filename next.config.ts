import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

// Report-Only: violations are reported (console + Sentry when DSN is set), nothing is blocked.
// 'unsafe-inline' documents today's reality (Next's hydration scripts are inline); nonces are the tightening path.
const toOrigin = (value?: string): string | undefined => {
  try { return value ? new URL(value).origin : undefined } catch { return undefined }
}

// Add per-project third-party origins here when the product adopts a new tool (same idea as images.remotePatterns).
// A Report-Only violation in Sentry/console tells you the exact origin and directive to add.
const PROJECT_CSP_SOURCES = {
  script: [] as string[],
  style: [] as string[],
  img: [] as string[],
  font: [] as string[],
  connect: [] as string[],
  frame: [] as string[]
}

// The Storyblok Visual Editor iframes every page, and X-Frame-Options has no allowlist form: with a token set the
// anti-clickjacking guard moves to an enforced `frame-ancestors` that admits the editor.
const storyblok = Boolean(process.env.STORYBLOK_TOKEN)
const FRAME_ANCESTORS = storyblok ? '\'self\' https://app.storyblok.com' : '\'self\''

const buildCspReportOnly = (): string => {
  const isDev = process.env.NODE_ENV !== 'production'
  const apiOrigin = toOrigin(process.env.NEXT_PUBLIC_API_URL)
  const clarity = Boolean(process.env.NEXT_PUBLIC_CLARITY_ID)
  const turnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)

  let reportUri: string | undefined
  try {
    // Browser-posted CSP reports count against the Sentry error quota — collect them only on staging.
    const dsn = process.env.NEXT_PUBLIC_APP_ENV === 'staging' ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined
    if (dsn) {
      const { host, pathname, username } = new URL(dsn)
      reportUri = `https://${host}/api${pathname}/security/?sentry_key=${username}`
    }
  } catch { /* malformed DSN — report endpoint skipped, policy still emitted */ }

  const src = {
    script: ['\'self\'', '\'unsafe-inline\'', 'https://browser.sentry-cdn.com', ...PROJECT_CSP_SOURCES.script],
    style: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com', ...PROJECT_CSP_SOURCES.style],
    img: ['\'self\'', 'data:', 'blob:', ...PROJECT_CSP_SOURCES.img],
    font: ['\'self\'', 'data:', 'https://fonts.gstatic.com', ...PROJECT_CSP_SOURCES.font],
    connect: ['\'self\'', 'https://*.ingest.sentry.io', 'https://*.ingest.us.sentry.io', ...PROJECT_CSP_SOURCES.connect],
    frame: [...PROJECT_CSP_SOURCES.frame]
  }
  if (clarity) {
    src.script.push('https://www.clarity.ms')
    src.connect.push('https://*.clarity.ms')
  }
  if (turnstile) {
    src.script.push('https://challenges.cloudflare.com')
    src.frame.push('https://challenges.cloudflare.com')
  }
  if (isDev) {
    src.script.push('https://unpkg.com')
    src.connect.push('ws:')
  }
  if (apiOrigin) src.connect.push(apiOrigin)

  return [
    'default-src \'self\'',
    `script-src ${src.script.join(' ')}`,
    `style-src ${src.style.join(' ')}`,
    `img-src ${src.img.join(' ')}`,
    `font-src ${src.font.join(' ')}`,
    `connect-src ${src.connect.join(' ')}`,
    ...(src.frame.length > 0 ? [`frame-src ${['\'self\'', ...src.frame].join(' ')}`] : []),
    'worker-src \'self\' blob:',
    'object-src \'none\'',
    'base-uri \'self\'',
    'form-action \'self\'',
    `frame-ancestors ${FRAME_ANCESTORS}`,
    ...(reportUri ? [`report-uri ${reportUri}`] : [])
  ].join('; ')
}

// A staging build runs with NODE_ENV=production, so it must be excluded explicitly:
// it is the environment that still needs console output and CSP reports.
const isStaging = process.env.NEXT_PUBLIC_APP_ENV === 'staging'
const isProduction = !isStaging &&
  (process.env.NEXT_PUBLIC_APP_ENV === 'production' || process.env.NODE_ENV === 'production')

const nextConfig: NextConfig = {
  // `next dev` would otherwise append its own agent-rules block to CLAUDE.md on every run.
  agentRules: false,
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
    removeConsole: isProduction
  },
  logging: {
    fetches: {
      fullUrl: !isProduction
    }
  },
  sassOptions: {
    additionalData: `
      @use "@/styles/mixins.sass" as mixins;
    `
  },

  images: {
    minimumCacheTTL: 31_536_000,
    formats: ['image/webp'],
    // Per-project external image origins go here (the media bucket, another CDN) — same idiom as PROJECT_CSP_SOURCES.
    remotePatterns: [
      // Storyblok asset CDN: every image edited through the CMS is served from here.
      { protocol: 'https', hostname: 'a.storyblok.com', pathname: '/**' }
    ]
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
          // Anti-clickjacking: only our own domain may iframe the app (plus the Storyblok editor when the CMS is on)
          ...(storyblok
            ? [{ key: 'Content-Security-Policy', value: `frame-ancestors ${FRAME_ANCESTORS}` }]
            : [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]),
          // Cross-domain navigations leak only the origin, not the full path
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          // Disable sensitive APIs by default; re-enable per feature (e.g. `geolocation=(self)`)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // Observe-first CSP — switch the key to Content-Security-Policy once reports come back clean.
          // Off in production: report-uri is staging-only there, so it would only spam the browser console.
          ...(isProduction
            ? []
            : [{ key: 'Content-Security-Policy-Report-Only', value: buildCspReportOnly() }])
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
