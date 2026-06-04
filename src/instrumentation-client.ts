// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { APP_ENV } from './constants/env'

const isDev = APP_ENV === 'development'
const isStaging = APP_ENV === 'staging'
const isProd = APP_ENV === 'production'

const values = {
  enabled: !isDev, // Disable Sentry on dev

  // Local: 0% | Staging: 100% | Prod: 10%
  traces: isDev ? 0 : isStaging ? 1.0 : 0.1,

  // Local: 0% | Staging: 100% | Prod: 10%
  replaysSession: isDev ? 0 : isStaging ? 1.0 : 0.1,

  // Local: 0% | Staging: 100% | Prod: 100%
  replaysError: isDev ? 0 : 1.0,

  // Debug: Only on staging
  debug: isStaging
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Session Replay is added lazily below to keep its chunk off the critical bundle
  integrations: [],

  tracesSampleRate: values.traces,
  enableLogs: !isDev,
  debug: values.debug,

  replaysSessionSampleRate: values.replaysSession,
  replaysOnErrorSampleRate: values.replaysError,

  // Send user PII (only on staging here)
  sendDefaultPii: isStaging
})

// Lazy-load Session Replay after init to move its bundle off the critical path.
if (!isDev) {
  Sentry.lazyLoadIntegration('replayIntegration')
    .then((replayIntegration) => {
      const client = Sentry.getClient()
      if (!client) return
      client.addIntegration(replayIntegration({
        maskAllText: isProd,
        blockAllMedia: isProd
      }))
    })
    .catch((error) => {
      console.error('Failed to lazy-load Sentry replayIntegration', error)
    })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart