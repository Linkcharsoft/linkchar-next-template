'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import type { DataTableStateEvent, SortOrder } from 'primereact/datatable'

type useTableParamsReturn<T> = {
  params: T & PaginationParams
  stringParams: string
  first: number
  sortProps: {
    sortField?: string
    sortOrder?: SortOrder
    onSort?: (event: DataTableStateEvent) => void
  }
  setParams: (newFilters: Partial<T & PaginationParams>) => void
  setParam: <K extends keyof (T & PaginationParams)>(key: K, value: (T & PaginationParams)[K]) => void
  setPagination: (newPagination: PaginationParams) => void
  resetParams: () => void
}

type SearchParams = {
  [key: string]: string | string[] | undefined
}

type PaginationParams = {
  page: number
  page_size: number
}
type Primitives = string | number | boolean | null

/**
 * Hook to synchronize filter and pagination state with the URL in Next.js App Router.
 * Provides parameters ready for use with PrimeReact's DataTable and Paginator components.
 * @template DefaultParams - Interface for custom filter parameters.
 * @param {Object} config - The hook configuration object.
 * @param {SearchParamsProps} config.searchParams - The asynchronous search parameters provided by the Next.js Page component.
 * By passing these directly, the hook avoids using `useSearchParams()`, which prevents the component from
 * triggering a Suspense boundary and allows for faster, more predictable state synchronization during SSR and hydration.
 * @param {DefaultParams & Partial<PaginationParams>} config.defaults - Default values for filters and pagination.
 * Values are auto-parsed to number or boolean based on these types.
 *
 * @returns {useTableParamsReturn<DefaultParams>} An object containing the following properties and methods:
 * - `params`: Object combining `page`, `page_size`, and custom filters with preserved types (merges URLSearchParams and DefaultParams).
 * - `stringParams`: Current query string (e.g., "page=1&search=hello"), ready for API requests (fetch/SWR).
 * - `first`: Reactive zero-based index of the first row to be displayed. (Required for PrimeReact's Paginator).
 * - `sortProps`: If the 'ordering' filter is used, this object contains 'sortField', 'sortOrder', and 'onSort' for PrimeReact's DataTable.
 * - `setParams`: `(newParams: Partial<TableParams>) => void` - Updates multiple filters at once. Automatically resets page to 1 (unless only the page is being changed).
 * - `setParam`: `(key: keyof TableParams, value: Primitives) => void` - Helper to update a single parameter.
 * - `setPagination`: `(pagination: PaginationParams) => void` - Helper to update page and page_size simultaneously.
 * - `resetParams`: `() => void` - Clears the URL and restores values to the initial `defaults`.
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
 *   defaults: {
 *     search: '',      // string
 *     ordering: '',    // string
 *     minPrice: 0,     // number
 *     isActive: true   // boolean
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
 *   page: e.page + 1,
 *   page_size: e.rows
 *   })}
 * />
 **/

export function useTableParams<DefaultParams extends Record<string, Primitives>> ({
  searchParams,
  defaults
}: {
  searchParams: SearchParams,
  defaults: DefaultParams & Partial<PaginationParams>
}): useTableParamsReturn<DefaultParams> {
  type TableParams = DefaultParams & PaginationParams

  const pathname = usePathname()
  const { replace } = useRouter()

  // 1. Parse search params as URLSearchParams object
  const urlParams: URLSearchParams = useMemo(() => {
    const params = new URLSearchParams()

    if(searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v))
        } else if (value !== undefined) { // !TODO
          params.set(key, value)
        }
      })
    }

    return params
  }, [searchParams])

  // 2. Setup default params
  const DEFAULT_PARAMS: TableParams = useMemo(() => ({
    page: 1,
    page_size: 10,
    ...defaults
  }), [JSON.stringify(defaults)])

  // 3. Current params: (URL search params + Default params + Auto-Parsing)
  const PARAMS: TableParams = useMemo(() => {
    const currentParams: TableParams = { ...DEFAULT_PARAMS }

    Object.keys(DEFAULT_PARAMS).forEach((k) => {
      const key = k as keyof TableParams
      const urlValue = urlParams.get(k)

      if (urlValue !== null) {
        const defaultValue = DEFAULT_PARAMS[key]

        const target = currentParams as Record<string, Primitives>

        switch (typeof defaultValue) {
          case 'number':
            target[k] = Number(urlValue)
            break
          case 'boolean':
            target[k] = urlValue === 'true'
            break
          default:
            target[k] = urlValue
        }
      }
    })

    return currentParams
  }, [urlParams, DEFAULT_PARAMS])

  // 4. Update params
  const setParams = useCallback(
    (newFilters: Partial<TableParams>) => {
      const params = new URLSearchParams(urlParams.toString())

      const isOnlyPageChange = Object.keys(newFilters).length === 1 && 'page' in newFilters

      if (!isOnlyPageChange && !newFilters.page) {
        params.set('page', '1')
      }

      Object.entries(newFilters).forEach(([key, value]) => {
        const valueIsValid = value !== undefined && value !== null && value !== ''
        if (valueIsValid) {
          params.set(key, String(value))
        } else {
          params.delete(key)
        }
      })

      replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
    },
    [urlParams, pathname, replace]
  )

  // Function helpers
  const setParam = useCallback(
    <K extends keyof TableParams>(key: K, value: TableParams[K]) => {
      const newParams: Partial<TableParams> = {}
      newParams[key] = value

      setParams(newParams)
    },
    [setParams]
  )
  const setPagination = useCallback((pagination: PaginationParams) => setParams(pagination as Partial<TableParams>), [setParams])
  const resetParams = useCallback(() => {
    const params = new URLSearchParams()

    Object.entries(DEFAULT_PARAMS).forEach(([key, value]) => {
      const valueIsValid = value !== undefined && value !== null && value !== ''
      if (valueIsValid) {
        params.set(key, String(value))
      }
    })

    replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
  }, [pathname, replace, DEFAULT_PARAMS])

  // PrimeReact helpers
  const first: useTableParamsReturn<DefaultParams>['first'] = (PARAMS.page - 1) * PARAMS.page_size

  const sortProps: useTableParamsReturn<DefaultParams>['sortProps'] = useMemo(() => {
    if (!('ordering' in PARAMS)) return {}

    const ordering = String(PARAMS.ordering || '')
    const isDesc = ordering.startsWith('-')

    return {
      sortField: ordering ? ordering.replace(/^-/, '') : undefined,
      sortOrder: (ordering ? (isDesc ? -1 : 1) : undefined) as SortOrder,
      onSort: (event: DataTableStateEvent) => {
        const key = 'ordering' as keyof TableParams

        if (!event.sortField) {
          setParam(key, '' as TableParams[typeof key])
          return
        }

        const direction = event.sortOrder === -1 ? '-' : ''
        const newValue = `${direction}${event.sortField}`
        setParam(key, newValue as TableParams[typeof key])
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