export const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN
export const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL
export const API_URL = process.env.NEXT_PUBLIC_API_URL
// NODE_ENV can be 'test' under some runners — anything but a production build counts as development.
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development')
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID
export const AUTH_SECRET = process.env.AUTH_SECRET
export const RESEND_API_KEY = process.env.RESEND_API_KEY
export const CONTACT_FROM = process.env.CONTACT_FROM
export const CONTACT_TO = process.env.CONTACT_TO
export const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

if(!DOMAIN || !API_URL) {
  throw new Error('Missing environment variables')
}

if(APP_ENV !== 'production' && APP_ENV !== 'staging' && APP_ENV !== 'development') {
  throw new Error('Invalid APP_ENV')
}
