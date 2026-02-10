import { redirect } from 'next/navigation'
import { NEXT_PUBLIC_API_URL, STRAPI_URL } from '@/constants'

type CustomFetchType = {
  path: string
  token?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object
  params?: string | URLSearchParams | Record<string, string> | string[][]
  headers?: Record<string, string>
  strapi?: boolean
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
  headers = { 'Content-Type': 'application/json' },
  strapi = false
}: CustomFetchType): Promise<CustomFetchResponse<T>> => {
  const urlPath = new URL(`/api${path}`, strapi ? STRAPI_URL : NEXT_PUBLIC_API_URL)
  if (params) urlPath.search = new URLSearchParams(params).toString()

  const requestHeaders = new Headers(headers)
  if (token) requestHeaders.append('Authorization', `Bearer ${token}`)

  const fetchOptions: FetchOptionsType = {
    method,
    headers: requestHeaders,
    body: undefined
  }

  if (body && !(body instanceof FormData)) fetchOptions.body = JSON.stringify(body)
  else fetchOptions.body = body

  let response = await fetch(urlPath.toString(), fetchOptions)

  if (response.status === 401) {
    try {
      const newAccessToken = await handleRefreshToken()

      return await customFetch<T>({ path, token: newAccessToken, method, body, params, headers, strapi })
    } catch (error) {
      console.error(error)
      handleUnauthorizedLogout()
    }
  }

  let data: T = {} as T
  if (response.status !== 204) data = await response.json()

  if (strapi && 'meta' in data && Object.keys((data as any).meta).length === 0) {
    delete (data as any).meta
    data = (data as any)?.data
  }

  return {
    response,
    ok: response.ok,
    data: response.ok ? data : ({} as T),
    error: response.ok ? null : data
  }
}

const handleRefreshToken = async (): Promise<string | undefined> => {
  let refreshedToken

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST'
    })

    if (!res.ok) throw new Error('Token refresh failed')

    const data = await res.json()

    refreshedToken = data.token
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error refreshing token'
    throw new Error(message)
  }

  return refreshedToken
}

const handleUnauthorizedLogout = async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  redirect('/login')
}
