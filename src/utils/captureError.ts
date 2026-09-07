import * as Sentry from '@sentry/nextjs'

// The console call is stripped by `compiler.removeConsole` in production builds only, so development
// and staging keep the immediate feedback while production reports through Sentry alone.
export const captureError = (scope: string, error: unknown, level: 'error' | 'warning' = 'error') => {
  console.error(`[${scope}]`, error)
  Sentry.captureException(error, { tags: { scope }, level })
}

export const captureInfo = (scope: string, message: string) => {
  console.info(`[${scope}]`, message)
  Sentry.logger.info(message, { scope })
}
