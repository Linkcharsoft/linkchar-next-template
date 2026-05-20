import { redirect } from 'next/navigation'
import { AUTH_ERRORS } from '@/constants/auth'
import { API_URL, DOMAIN } from '@/constants/env'

type CustomFetchType = {
  path: string
  token?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object | FormData
  params?: string | URLSearchParams | Record<string, string> | string[][]
  headers?: Record<string, string>
  // Cache controls — default is `no-store` (app data should be fresh). Override per call:
  // - `cache: 'force-cache'` to opt in to full caching
  // - `next: { revalidate: 60 }` for ISR
  // - `next: { tags: ['user'] }` for on-demand revalidation
  cache?: RequestCache
  next?: { revalidate?: number | false, tags?: string[] }
  _retryCount?: number
}

type CustomFetchResponse<T extends object> = {
  response: Response
  ok: boolean
  data: T
  error: unknown
}

type FetchOptionsType = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers: Headers
  body?: string | FormData
  cache?: RequestCache
  next?: { revalidate?: number | false, tags?: string[] }
}

const MAX_RETRIES = 1

/**
 * A custom `fetch` wrapper that automatically handles:
 * 1. URL construction based on environment constants.
 * 2. Injection of authentication tokens.
 * 3. Automatic token refresh in case of 401 (Unauthorized) errors.
 * 4. User sign-out if the token refresh process fails.
 *
 * @template T - The expected type for the `data` object in the response.
 * @param {CustomFetchType} params - The request configuration options.
 * @returns {Promise<CustomFetchResponse<T>>} An object containing the original response, success status, and the parsed data or error.
 * * @example
 * ```typescript
 * const { data, ok } = await customFetch<{ name: string, email: string }>({
 *   path: '/profile',
 *   method: 'GET',
 *   token: 'my-token'
 * });
 * ```
 */

export const customFetch = async <T extends object>({
  path,
  token,
  method,
  body,
  params,
  headers = { 'Content-Type': 'application/json' },
  cache,
  next,
  _retryCount = 0
}: CustomFetchType): Promise<CustomFetchResponse<T>> => {
  // URL
  const urlPath = new URL(`/api${path}`, API_URL)

  if (params) urlPath.search = new URLSearchParams(params).toString()

  // Headers
  const requestHeaders = new Headers(headers)
  if (token) requestHeaders.append('Authorization', `Bearer ${token}`)
  if (body instanceof FormData) requestHeaders.delete('Content-Type')

  // Body
  const fetchOptions: FetchOptionsType = {
    method,
    headers: requestHeaders,
    body: body instanceof FormData
      ? body
      : body
        ? JSON.stringify(body)
        : undefined
  }

  // Cache policy — explicit to keep behavior stable across Next.js versions.
  // Defaults to `no-store` (fresh app data); callers can override with `next.revalidate` for ISR.
  if (next) {
    fetchOptions.next = next
  } else {
    fetchOptions.cache = cache ?? 'no-store'
  }

  // Fetch
  let response = await fetch(urlPath.toString(), fetchOptions)

  if (response.status === 401 && _retryCount < MAX_RETRIES) {
    try {
      const newAccessToken = await handleRefreshToken()

      if(!newAccessToken) throw new Error(AUTH_ERRORS['no-refresh-token'])

      return await customFetch<T>({
        path,
        token: newAccessToken,
        method,
        body,
        params,
        headers,
        cache,
        next,
        _retryCount: _retryCount + 1
      })
    } catch (error) {
      console.error(error)
      handleUnauthorizedLogout()
    }
  }

  let data: T = {} as T

  if (response.status !== 204) {
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      }
    } catch (error) {
      console.error(error)
      throw new Error('The response was not a JSON')
    }
  }

  return {
    response,
    ok: response.ok,
    data: response.ok ? data : ({} as T),
    error: response.ok ? null : data
  }
}

const handleRefreshToken = async (): Promise<string | undefined> => {
  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      credentials: typeof window === 'undefined' ? undefined : 'include',
      cache: 'no-store'
    }

    if (typeof window === 'undefined') {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

      if (cookieHeader) {
        fetchOptions.headers = { 'Cookie': cookieHeader }
      }
    }

    const res = await fetch(`${DOMAIN}/api/auth/refresh`, fetchOptions)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(`${AUTH_ERRORS['refresh-token']}: ${data.message}`)
    }

    const data = await res.json()

    if (!data.token) {
      throw new Error(`${AUTH_ERRORS['refresh-token']}: No token in response`)
    }

    return data.token
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_ERRORS['refresh-token']
    throw new Error(message)
  }
}

const handleUnauthorizedLogout = async () => {
  try {
    await fetch(`${DOMAIN}/api/auth/logout`, { method: 'POST', cache: 'no-store' })
  } catch (e) {
    console.error('Error on logout', e)
  } finally {
    redirect('/login')
  }
}
