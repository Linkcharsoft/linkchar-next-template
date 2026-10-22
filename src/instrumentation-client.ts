import * as Sentry from '@sentry/nextjs'
import { APP_ENV } from './constants/env'
import { SENTRY_DATA_COLLECTION } from './constants/sentry'
import { captureInfo } from './utils/captureError'

const isDev = APP_ENV === 'development'
const isStaging = APP_ENV === 'staging'
const isProd = APP_ENV === 'production'

const values = {
  enabled: !isDev,

  // Local: 0% | Staging: 100% | Prod: 10%
  traces: isDev ? 0 : (isStaging ? 1 : 0.1),

  // Local: 0% | Staging: 100% | Prod: 10%
  replaysSession: isDev ? 0 : (isStaging ? 1 : 0.1),

  // Local: 0% | Staging: 100% | Prod: 100%
  replaysError: isDev ? 0 : 1,

  // Debug: Only on staging
  debug: isStaging
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: APP_ENV,

  enabled: values.enabled,

  // Session Replay is added lazily below to keep its chunk off the critical bundle
  integrations: [],

  tracesSampleRate: values.traces,
  debug: values.debug,

  replaysSessionSampleRate: values.replaysSession,
  replaysOnErrorSampleRate: values.replaysError,

  dataCollection: SENTRY_DATA_COLLECTION
})

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
    .catch((error: unknown) => {
      // Ad blockers block browser.sentry-cdn.com while /monitoring still tunnels events: not a site failure.
      captureInfo('replay-lazy-load', error instanceof Error ? error.message : String(error))
    })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart