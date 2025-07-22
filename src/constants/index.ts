export const API_URL = process.env.API_URL
export const AUTH_SECRET = process.env.AUTH_SECRET
export const STRAPI_URL = process.env.STRAPI_URL

export const AUTH_COOKIE_NAME = 'linkchar-session'

export const AUTH_TOKEN_ERRORS = {
  'not-found': 'No session found',
  'invalid': 'Invalid session',
  'general': 'Failed to get session'
}