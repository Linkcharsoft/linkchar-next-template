import { signOut , getSession } from 'next-auth/react'
import { API_URL, STRAPI_URL } from '@/constants'

type CustomFetchType = {
  path: string
  token?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: object
  params?: string | URLSearchParams | Record<string, string> | string[][] | any
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

export const customFetch = async <T extends object>({
  path,
  token,
  method,
  body,
  params,
  headers = { 'Content-Type': 'application/json' },
  strapi = false
}: CustomFetchType): Promise<CustomFetchResponse<T>> => {
  const urlPath = new URL(`${path}`, strapi ? STRAPI_URL : API_URL)
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
    const newAccessToken = await refreshToken()

    if (newAccessToken) {
      requestHeaders.set('Authorization', `Bearer ${newAccessToken}`)
      fetchOptions.headers = requestHeaders

      response = await fetch(urlPath.toString(), fetchOptions)

      if (response.ok) {
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
    }
    
    handleSignOut()
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

const refreshToken = async (): Promise<string | null> => {
  try {
    const refresh = await getSession()
    if (!refresh) return null

    const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refresh.user.refresh })
    })

    if (!res.ok) throw new Error('Token refresh failed')

    const refreshedTokens = await res.json()
    return refreshedTokens.access
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

const handleSignOut = () => {
  signOut({ callbackUrl: '/login' })
}
