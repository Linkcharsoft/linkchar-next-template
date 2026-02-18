// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
