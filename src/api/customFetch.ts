import { redirect } from 'next/navigation'
import { API_URL } from '@/constants/env'

type CustomFetchType = {
  path: string
  token?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object | FormData
  params?: string | URLSearchParams | Record<string, string> | string[][]
  headers?: Record<string, string>
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
  headers = { 'Content-Type': 'application/json' }
}: CustomFetchType): Promise<CustomFetchResponse<T>> => {
  // URL
  const urlPath = new URL(`/api${path}`, API_URL)

  if (params) urlPath.search = new URLSearchParams(params).toString()

  // Headers
  const requestHeaders = new Headers(headers)
  if (token) requestHeaders.append('Authorization', `Bearer ${token}`)

  if (body instanceof FormData) {
    requestHeaders.delete('Content-Type')
  }

  // Body
  const fetchOptions: FetchOptionsType = {
    method,
    headers: requestHeaders,
    body: undefined
  }

  if (body && !(body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(body)
  } else {
    fetchOptions.body = body as FormData | undefined
  }

  // Fetch
  let response = await fetch(urlPath.toString(), fetchOptions)

  if (response.status === 401) {
    try {
      const newAccessToken = await handleRefreshToken()

      if(!newAccessToken) throw new Error('No access token returned from refresh')

      return await customFetch<T>({ path, token: newAccessToken, method, body, params, headers })
    } catch (error) {
      console.error(error)
      await handleUnauthorizedLogout()
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
      console.warn('The response was not a JSON', e)
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
    const res = await fetch('/api/auth/refresh', {
      method: 'POST'
    })

    if (!res.ok) throw new Error('Token refresh failed')

    const data = await res.json()

    return data.token
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error refreshing token'
    throw new Error(message)
  }
}

const handleUnauthorizedLogout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('Error on logout', e)
  } finally {
    redirect('/login')
  }
}
