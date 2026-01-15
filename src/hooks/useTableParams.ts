'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import type { DataTableStateEvent, SortOrder } from 'primereact/datatable'

type useTableParamsReturn<T> = {
  params: T & MandatoryParams
  stringParams: string
  first: number
  sortProps?: {
    sortField?: string
    sortOrder?: SortOrder
    onSort?: (event: DataTableStateEvent) => void
  }
  setParams: (newFilters: Partial<T & MandatoryParams>) => void
  setParam: <K extends keyof (T & MandatoryParams)>(key: K, value: (T & MandatoryParams)[K]) => void
  setPagination: (newPagination: MandatoryParams) => void
  resetParams: () => void
}

type MandatoryParams = {
  page: number
  page_size: number
}
type Primitives = string | number | boolean | null

/**
 * Hook to synchronize filter and pagination state with the URL in Next.js App Router.
 * Provides parameters ready for use with PrimeReact's DataTable and Paginator components.
 * @template DefaultParams - Interface for custom filter parameters.
 * @param {DefaultParams & Partial<MandatoryParams>} defaults - Default values.
 * If a value is a `number` or `boolean`, the hook will automatically parse the URL value to that type and return it within the params object.
 *
 * @returns {useTableParamsReturn} An object containing the following properties and methods:
 * - `params`: Object combining `page`, `page_size`, and custom filters with preserved types (merges URLSearchParams and DefaultParams).
 * - `stringParams`: Current query string (e.g., "page=1&search=hello"), ready for API requests (fetch/SWR).
 * - `first`: Reactive zero-based index of the first row to be displayed. (Required for PrimeReact's Paginator).
 * - `sortProps`: If the 'ordering' filter is used, this object contains 'sortField', 'sortOrder', and 'onSort' for PrimeReact's DataTable.
 * - `setParams`: `(newParams: Partial<TableParams>) => void` - Updates multiple filters at once. Automatically resets page to 1 (unless only the page is being changed).
 * - `setParam`: `(key: keyof TableParams, value: Primitives) => void` - Helper to update a single parameter.
 * - `setPagination`: `(pagination: MandatoryParams) => void` - Helper to update page and page_size simultaneously.
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
 *   search: '',      // string
 *   ordering: '',    // string
 *   minPrice: 0,     // number
 *   isActive: true   // boolean
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

export function useTableParams<DefaultParams extends Record<string, Primitives>> (
  defaults: DefaultParams & Partial<MandatoryParams>
): useTableParamsReturn<DefaultParams> {
  type TableParams = DefaultParams & MandatoryParams

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  // 1. Setup default params
  const DEFAULT_PARAMS: TableParams = useMemo(() => ({
    page: 1,
    page_size: 10,
    ...defaults
  }), [JSON.stringify(defaults)])

  // 2. Current params: (URL search params + Default params + Auto-Parsing)
  const PARAMS: TableParams = useMemo(() => {
    const currentParams: TableParams = { ...DEFAULT_PARAMS }

    Object.keys(DEFAULT_PARAMS).forEach((k) => {
      const urlValue = searchParams.get(k)
      const key = k as keyof TableParams

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
  }, [searchParams, DEFAULT_PARAMS])

  // 3. Update params
  const setParams = useCallback(
    (newFilters: Partial<TableParams>) => {
      const urlParams = new URLSearchParams(searchParams.toString())

      if (newFilters.page === undefined) urlParams.set('page', '1')

      Object.entries(newFilters).forEach(([key, value]) => {
        const valueIsValid = value !== undefined && value !== null && value !== ''
        if (valueIsValid) {
          urlParams.set(key, String(value))
        } else {
          urlParams.delete(key)
        }
      })

      replace(`${pathname}?${urlParams.toString()}` as Route, { scroll: false })
    },
    [searchParams, pathname, replace]
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
  const setPagination = useCallback((pagination: MandatoryParams) => setParams(pagination as Partial<TableParams>), [setParams])
  const resetParams = useCallback(() => {
    const urlParams = new URLSearchParams()

    Object.entries(DEFAULT_PARAMS).forEach(([key, value]) => {
      const valueIsValid = value !== undefined && value !== null && value !== ''
      if (valueIsValid) {
        urlParams.set(key, String(value))
      }
    })

    replace(`${pathname}?${urlParams.toString()}` as Route, { scroll: false })
  }, [pathname, replace, DEFAULT_PARAMS])

  // PrimeReact helpers
  const FIRST: number = (PARAMS.page - 1) * PARAMS.page_size

  const SORT_PROPS: useTableParamsReturn<DefaultParams>['sortProps'] = useMemo(() => {
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
  }, [PARAMS.ordering, setParam])

  return {
    params: PARAMS,
    stringParams: searchParams.toString(),
    first: FIRST,
    sortProps: SORT_PROPS,
    setParams,
    setParam,
    setPagination,
    resetParams
  }
}