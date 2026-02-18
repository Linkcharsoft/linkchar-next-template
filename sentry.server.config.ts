// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'
import { APP_ENV } from '@/constants/env'

const isDev = APP_ENV === 'development'
const isStaging = APP_ENV === 'staging'

Sentry.init({
  enabled: !isDev, // Disable Sentry on dev

  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: isDev ? 0 : isStaging ? 1.0 : 0.1, // Local: 0% | Staging: 100% | Prod: 10%

  // Enable logs to be sent to Sentry
  enableLogs: !isDev,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: isStaging
})
