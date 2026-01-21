'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import type { DataTableStateEvent, SortOrder } from 'primereact/datatable'

type SearchParams = {
  [key: string]: string | string[] | undefined
}

type UniqueValueConfig = {
  type: 'string'
  value?: string
} | {
  type: 'number'
  value?: number
} | {
  type: 'boolean'
  value?: boolean
}
type MultipleValueConfig = {
  type: 'string'
  value?: string[]
} | {
  type: 'number'
  value?: number[]
}

type ParamConfig = (
  UniqueValueConfig & {
    isArray?: false
  }
) | (
  MultipleValueConfig & {
    isArray: true
  }
)

type PaginationConfig = {
  page: {
    type: 'number',
    value: number,
    isArray?: false
  },
  page_size: {
    type: 'number',
    value: number,
    isArray?: false
  }
}

type ParamsMap = Record<string, ParamConfig>

type ExtractParamType<Param extends ParamConfig> =
  Param extends { isArray: true, type: 'number' } ? number[]
    // : Param extends { isArray: true, type: 'boolean' } ? boolean[]
    : Param extends { isArray: true, type: 'string' } ? string[]
      : Param extends { type: 'number' } ? number
        : Param extends { type: 'boolean' } ? boolean
          : string | undefined

type ReturnedParams<Param extends ParamsMap> = {
  [ParamKey in keyof Param]: ExtractParamType<Param[ParamKey]>
} & {
  page: number
  page_size: number
}

type useTableParamsReturn<Param extends ParamsMap> = {
  params: ReturnedParams<Param>
  stringParams: string
  first: number
  sortProps: {
    sortField?: string
    sortOrder?: SortOrder
    onSort?: (event: DataTableStateEvent) => void
  }
  setParams: (newParams: Partial<ReturnedParams<Param>>) => void
  setParam: <ParamKey extends keyof ReturnedParams<Param>>(key: ParamKey, value: ReturnedParams<Param>[ParamKey]) => void
  setPagination: (pagination: { page: number, page_size: number }) => void
  resetParams: () => void
}

/**
 * Hook to synchronize filter and pagination state with the URL in Next.js App Router.
 * Provides parameters ready for use with PrimeReact's DataTable and Paginator components.
 * @template DefaultParams - Interface for custom filter parameters.
 * @param {Object} config - The hook configuration object.
 * @param {SearchParams} config.searchParams - The asynchronous search parameters provided by the Next.js Page component.
 * By passing these directly, the hook avoids using `useSearchParams()`, which prevents the component from
 * triggering a Suspense boundary and allows for faster, more predictable state synchronization during SSR and hydration.
 * @param {DefaultParams & Partial<PaginationParams>} config.defaultParams - Default values for filters and pagination.
 * Values are auto-parsed to string, number or boolean based on filter types.
 *
 * @returns {useTableParamsReturn<DefaultParams>} An object containing the following properties and methods:
 * - `params`: Object combining `page`, `page_size`, and custom filters with preserved types (merges URLSearchParams and DefaultParams).
 * - `stringParams`: Current query string (e.g., "page=1&search=hello"), ready for API requests (fetch/SWR).
 * - `first`: Reactive zero-based index of the first row to be displayed. (Required for PrimeReact's Paginator).
 * - `sortProps`: If the 'ordering' filter is used, this object contains 'sortField', 'sortOrder', and 'onSort' for PrimeReact's DataTable.
 * - `setParams`: `(newParams: Partial<ReturnedParams<T>>) => void` - Updates multiple filters at once. Automatically resets page to 1 (unless only the page is being changed).
 * - `setParam`: `(key: keyof TableParams, value: PrimitiveValues) => void` - Helper to update a single parameter.
 * - `setPagination`: `(pagination: { page: number, page_size: number }) => void` - Helper to update page and page_size simultaneously.
 * - `resetParams`: `() => void` - Clears the URL and restores values to the initial `defaultParams`.
 *
 * @example
 * // Filter definition
 * const {
 *   params,
 *   stringParams,
 *   first,
 *   sortProps,
 *   setParams,
 *   setParam,
 *   setPagination,
 *   resetParams
 * } = useTableParams({
 *   searchParams,
 *   defaultParams: {
 *     search: {
 *       type: 'string'
 *       value: ''
 *     },
 *     ordering: {
 *       type: 'string',
 *       value: ''
 *     },
 *     minPrice: {
 *       type: 'number',
 *       value: 0
 *     },
 *     isActive: {
 *       type: 'boolean',
 *       value: true
 *     }
 *   }
 * })
 *
 * // API Request usage
 * const { data } = useSWR(
 *   token ? `/api/data/?${stringParams}` : null,
 *   (path) => getData(path, token)
 * )
 *
 * // PrimeReact DataTable and Paginator usage
 * <DataTable
 *   value={data}
 *   rows={params.page_size}
 *   sortField={sortProps.sortField}
 *   sortOrder={sortProps.sortOrder}
 *   onSort={sortProps.onSort}
 * >
 *   ...
 * </DataTable>
 *
 * <Paginator
 *   first={first}
 *   rows={params.page_size}
 *   totalRecords={data.count}
 *   rowsPerPageOptions={[10, 20, 30]}
 *   onPageChange={(e) => setPagination({
 *     page: e.page + 1,
 *     page_size: e.rows
 *   })}
 * />
 **/

export function useTableParams<DefaultParams extends ParamsMap> ({
  searchParams,
  defaultParams
}: {
  searchParams: SearchParams,
  defaultParams: DefaultParams & Partial<PaginationConfig>
}): useTableParamsReturn<DefaultParams> {
  const pathname = usePathname()
  const { replace } = useRouter()

  // 1. Parse search params as URLSearchParams object
  const urlParams: URLSearchParams = useMemo(() => {
    const params = new URLSearchParams()

    if(searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else if (value !== undefined) {
          params.set(key, value)
        }
      })
    }

    return params
  }, [searchParams])

  // 2. Setup default params
  const DEFAULT_PARAMS: ParamsMap & PaginationConfig = useMemo(() => ({
    page: {
      value: 1,
      type: 'number'
    },
    page_size: {
      value: 10,
      type: 'number'
    },
    ...defaultParams
  }), [JSON.stringify(defaultParams)])

  // 3. Current params: (URL search params + Default params + Auto-Parsing)
  const PARAMS: ReturnedParams<DefaultParams> = useMemo(() => {
    const currentParams: object = {}

    Object.keys(DEFAULT_PARAMS).forEach((k) => {
      const defaultParam = DEFAULT_PARAMS[k]

      if (defaultParam.isArray) {
        const paramValues = urlParams.getAll(k)

        if (paramValues.length > 0) {
          switch (defaultParam.type) {
            case 'number':
              currentParams[k] = paramValues.map(Number)
              break
            default:
              currentParams[k] = paramValues
          }
        } else {
          currentParams[k] = []
        }
      } else {
        const paramValue = urlParams.get(k)

        if(paramValue !== null) {
          switch (defaultParam.type) {
            case 'number':
              currentParams[k] = paramValue !== '' ? Number(paramValue) : undefined
              break
            case 'boolean':
              currentParams[k] = paramValue !== '' ? paramValue === 'true' : undefined
              break
            default:
              currentParams[k] = paramValue
          }
        } else {
          currentParams[k] = defaultParam.value
        }
      }
    })

    return currentParams as ReturnedParams<DefaultParams>
  }, [urlParams, DEFAULT_PARAMS])

  // 4. Update params
  const setParams = useCallback(
    (newParams: Partial<ReturnedParams<DefaultParams>>) => {
      const params = new URLSearchParams(urlParams.toString())

      const isOnlyPageChange = Object.keys(newParams).length === 1 && 'page' in newParams
      if (!isOnlyPageChange && !newParams.page) {
        params.set('page', '1')
      }

      Object.entries(newParams).forEach(([key, value]) => {
        if(!(key in DEFAULT_PARAMS)) throw new Error(`[${key}] is not defined in defaultParams`)

        const valueIsValid = value !== undefined && value !== null && value !== ''

        if (valueIsValid) {
          if (Array.isArray(value)) {
            params.delete(key)
            value.forEach(v => params.append(key, String(v)))
          } else {
            params.set(key, String(value))
          }
        } else {
          if(key === 'page' || key === 'page_size') return

          const hasDefault = DEFAULT_PARAMS[key].value

          if (hasDefault !== undefined) {
            params.set(key, '')
          } else {
            params.delete(key)
          }
        }
      })

      replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
    },
    [urlParams, pathname, replace]
  )

  // Function helpers
  const setParam = useCallback(
    <K extends keyof ReturnedParams<DefaultParams>>(key: K, value: ReturnedParams<DefaultParams>[K]) => {
      const newParams: Partial<ReturnedParams<DefaultParams>> = {}
      newParams[key] = value

      setParams(newParams)
    },
    [setParams]
  )
  const setPagination = useCallback((pagination: { page: number, page_size: number }) => setParams(pagination as Partial<ReturnedParams<DefaultParams>>), [setParams])
  const resetParams = useCallback(() => {
    const params = new URLSearchParams()

    Object.entries(DEFAULT_PARAMS).forEach(([key, param]) => {
      const defaultValue = param.value

      if(defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
        if(Array.isArray(defaultValue)) {
          const valueIsValid = defaultValue.length > 0

          if (valueIsValid) {
            defaultValue.forEach(v => params.append(key, String(v)))
          }
        } else {
          params.set(key, String(defaultValue))
        }
      }
    })

    replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
  }, [pathname, replace, DEFAULT_PARAMS])

  // PrimeReact helpers
  const first = ((PARAMS.page as number) - 1) * (PARAMS.page_size as number)

  const sortProps = useMemo(() => {
    if (!('ordering' in DEFAULT_PARAMS)) return {}

    const ordering = String(PARAMS.ordering || '')
    const isDesc = ordering.startsWith('-')

    return {
      sortField: ordering ? ordering.replace(/^-/, '') : undefined,
      sortOrder: (ordering ? (isDesc ? -1 : 1) : undefined) as SortOrder,
      onSort: (event: DataTableStateEvent) => {
        const key = 'ordering' as keyof ReturnedParams<DefaultParams>

        if (!event.sortField) {
          setParam(key, '' as ReturnedParams<DefaultParams>[typeof key])
          return
        }

        const direction = event.sortOrder === -1 ? '-' : ''
        const newValue = `${direction}${event.sortField}`
        setParam(key, newValue as ReturnedParams<DefaultParams>[typeof key])
      }
    }
  }, [PARAMS.ordering, DEFAULT_PARAMS.ordering, setParam])

  return {
    params: PARAMS,
    stringParams: urlParams.toString(),
    first,
    sortProps,
    setParams,
    setParam,
    setPagination,
    resetParams
  }
}