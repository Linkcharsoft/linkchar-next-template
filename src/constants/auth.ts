import type { Route } from 'next'

export const AUTHENTICATED_HOME_PATH: Route = '/dashboard'

export const AUTH_COOKIE_NAME = 'linkchar-session'

export const AUTH_BACKEND_EMAIL_ADDRESS = 'base@linkchar.com'

export const AUTH_TOKEN_ERRORS = {
  'not-found': 'No session found',
  'invalid': 'Invalid session',
  'general': 'Failed to get session'
}

export const AUTH_INPUT_ERRORS = {
  general: 'Something went wrong, please try again',
  required: 'Required',
  'invalid-email': 'Enter a valid email address',
  'invalid-email-or-password': 'Invalid email or password',
  'verify-email': 'Email not verified',
  'password-length': 'Minimum of 8 characters',
  'password-numeric': 'Cannot be entirely numeric',
  // 'password-alphanumeric': 'Must contain at least one number',
  'password-uppercase': 'Must contain at least one uppercase letter',
  'password-symbol': 'Must contain at least one symbol'
}

export const AUTH_EMAIL_SUBJECTS = {
  'verify-email': 'Confirma tu e-mail en Django Base'
}