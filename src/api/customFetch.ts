import { redirect } from 'next/navigation'
import { AUTH_TOKEN_ERRORS } from '@/constants/auth'
import { API_URL, DOMAIN } from '@/constants/env'

type CustomFetchType = {
  path: string
  token?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object | FormData
  params?: string | URLSearchParams | Record<string, string> | string[][]
  headers?: Record<string, string>
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

  // Fetch
  let response = await fetch(urlPath.toString(), fetchOptions)

  if (response.status === 401 && _retryCount < MAX_RETRIES) {
    try {
      const newAccessToken = await handleRefreshToken()

      if(!newAccessToken) throw new Error(AUTH_TOKEN_ERRORS['no-refresh-token'])

      return await customFetch<T>({
        path,
        token: newAccessToken,
        method,
        body,
        params,
        headers,
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
    } catch (e) {
      console.error(e)
      throw new Error(AUTH_TOKEN_ERRORS['parse-response'])
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
    // eslint-disable-next-line no-undef
    const fetchOptions: RequestInit = {
      method: 'POST',
      credentials: typeof window === 'undefined' ? undefined : 'include'
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
      throw new Error(`${AUTH_TOKEN_ERRORS['refresh-token']}: ${data.message}`)
    }

    const data = await res.json()

    if (!data.token) {
      throw new Error(`${AUTH_TOKEN_ERRORS['refresh-token']}: No token in response`)
    }

    return data.token
  } catch (error) {
    const message = error instanceof Error ? error.message : AUTH_TOKEN_ERRORS['refresh-token']
    throw new Error(message)
  }
}

const handleUnauthorizedLogout = async () => {
  try {
    await fetch(`${DOMAIN}/api/auth/logout`, { method: 'POST' })
  } catch (e) {
    console.error('Error on logout', e)
  } finally {
    redirect('/login')
  }
}
