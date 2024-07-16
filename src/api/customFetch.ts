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
  if (token) requestHeaders.append('Authorization', `Token ${token}`)

  const fetchOptions: FetchOptionsType = {
    method,
    headers: requestHeaders,
    body: undefined
  }

  if (body && !(body instanceof FormData)) fetchOptions.body = JSON.stringify(body)
  else fetchOptions.body = body

  try {
    const response = await fetch(urlPath.toString(), fetchOptions)

    if (response.status === 401) deleteInvalidToken()

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
  } catch (error) {
    return handleError<T>(error, requestHeaders)
  }
}

const deleteInvalidToken = () => {
  localStorage.removeItem('token')
  window.dispatchEvent(new Event('storage'))
}

const handleError = <T extends object>(error: unknown, headers: Headers): CustomFetchResponse<T> => {
  const response = new Response('Something went wrong', {
    status: 500,
    headers
  })

  return {
    response,
    ok: false,
    data: {} as T,
    error: error ?? 'Something went wrong'
  }
}
