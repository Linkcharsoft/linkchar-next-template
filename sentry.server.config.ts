import * as Sentry from '@sentry/nextjs'
import { APP_ENV } from '@/constants/env'
import { SENTRY_DATA_COLLECTION } from '@/constants/sentry'

const isDev = APP_ENV === 'development'
const isStaging = APP_ENV === 'staging'

Sentry.init({
  enabled: !isDev,

  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: APP_ENV,

  tracesSampleRate: isDev ? 0 : (isStaging ? 1 : 0.1), // Local: 0% | Staging: 100% | Prod: 10%

  dataCollection: SENTRY_DATA_COLLECTION
})
