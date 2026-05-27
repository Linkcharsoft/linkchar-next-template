import { redirect } from 'next/navigation'
import { AUTH_ERRORS } from '@/constants/auth'
import { API_URL } from '@/constants/env'

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
 * `fetch` wrapper: URL construction, token injection, client-side 401 refresh + retry,
 * forced logout on refresh failure. Server-side 401s are returned as-is (proxy handles refresh).
 *
 * @example
 * const { data, ok } = await customFetch<{ name: string }>({
 *   path: '/profile',
 *   method: 'GET',
 *   token: 'my-token'
 * })
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
  const response = await fetch(urlPath.toString(), fetchOptions)

  // Client-side only: server-side 401s bubble up; the proxy handles refresh proactively.
  if (
    response.status === 401 &&
    _retryCount < MAX_RETRIES &&
    typeof window !== 'undefined'
  ) {
    try {
      const newAccessToken = await handleRefreshToken()
      if (!newAccessToken) throw new Error(AUTH_ERRORS['no-refresh-token'])

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
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store'
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`${AUTH_ERRORS['refresh-token']}: ${data.message}`)
  }

  const data = await res.json()
  if (!data.token) throw new Error(`${AUTH_ERRORS['refresh-token']}: No token in response`)

  return data.token
}

const handleUnauthorizedLogout = async () => {
  // Relative URL so the browser receives the delete-cookie headers (a `${DOMAIN}/...` call
  // would set them on the wrong response).
  try {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
  } catch (e) {
    console.error('Logout request failed:', e)
  } finally {
    redirect('/login')
  }
}
