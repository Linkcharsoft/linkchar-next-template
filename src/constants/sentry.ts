import { APP_ENV } from '@/constants/env'
import type { init } from '@sentry/nextjs'

const PII_FRAGMENTS = ['forwarded', '-ip', 'remote-', 'via', '-user']

// v11 collects PII by default; outside staging this restores v10's `sendDefaultPii: false` baseline.
export const SENTRY_DATA_COLLECTION: Parameters<typeof init>[0]['dataCollection'] = APP_ENV === 'staging'
  ? undefined
  : {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { deny: PII_FRAGMENTS }, response: { deny: PII_FRAGMENTS } },
    httpBodies: [],
    urlQueryParams: { deny: PII_FRAGMENTS },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
    stackFrameVariables: false
  }
