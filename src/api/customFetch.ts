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


/**
 * Wrapper personalizado de `fetch` que gestiona automáticamente:
 * 1. Construcción de URLs basadas en constantes de entorno.
 * 2. Inyección de tokens de autenticación.
 * 3. Refresco de tokens automático en caso de errores 401.
 * 4. Cierre de sesión si el refresco de token falla.
 *
 * @template T - El tipo esperado para el objeto `data` en la respuesta.
 * @param {CustomFetchType} params - Configuración de la petición.
 * @returns {Promise<CustomFetchResponse<T>>} Un objeto que contiene la respuesta original, el estado de éxito y los datos/error.
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
  const urlPath = new URL(`/api${path}`, strapi ? STRAPI_URL : API_URL)
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
  // try {
  //   const refresh = await getSession()
  //   if (!refresh) return null

  //   const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ refresh: refresh.user.refresh })
  //   })

  //   if (!res.ok) throw new Error('Token refresh failed')

  //   const refreshedTokens = await res.json()
  //   return refreshedTokens.access
  // } catch (error) {
  //   console.error('Error refreshing token:', error)
  //   return null
  // }
  return null
}

const handleSignOut = () => {
  // signOut({ callbackUrl: '/login' })
}
