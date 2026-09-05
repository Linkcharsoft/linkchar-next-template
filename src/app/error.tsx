'use client'
import ErrorPage from '@/screens/ErrorPage/ErrorPage'

const ErrorBoundary = ({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => <ErrorPage error={error} reset={reset}/>

export default ErrorBoundary
