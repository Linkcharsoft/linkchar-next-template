/*
@hook useParamsHandler

@description
This hook is used to handle the URL params in the URL, it will update the URL params and navigate to the new URL.

@how-to-use
- Define -
const {
    updateParam,
    updateParams // Function to update multiple params (optional)
  } = useParamsHandler(
    {
      search: paramSearch,
      page: paramPage,
      page_size: PAGE_SIZE,
      status: statusFilter
    },
    params
  )

- use -
updateParam('search', value, true) // Update single param with reset page
updateParam('search', value, false, true) // Update single param with scroll
updateParam('search', value, true, true) // Update single param with reset page and scroll

updateParams({ search: value, page: 1 }, true) // Update multiple params with scroll
*/

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'

let intervalId

export default function useParamsHandler<
  T extends Record<string, string | number | Array<string> | Array<number> | null>
>(
  params = {} as T,
  initialParams: string | URLSearchParams | Record<string, string> | string[][] | undefined
): {
  params: T
  updateParam: <Key extends keyof T>(
    name: Key,
    value: T[Key] | ((value: T[Key]) => T[Key]),
    resetPage?: boolean,
    scroll?: boolean
  ) => void
  updateParams: (object: Partial<T>, scroll?: boolean) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const handleURLSearchParams = (newParams: T, scroll = false) => {
    const current = new URLSearchParams(initialParams)

    // Add params from state
    Object.entries(newParams).forEach(([key, value]) => {
      current.delete(key)
      if (value === null) return current.delete(key)
      if (Array.isArray(value)) {
        return value.forEach((v: string | number) => {
          if (typeof v === 'string' && v) current.append(key, v)
          else current.append(key, v.toString())
        })
      }
      if (typeof value === 'string') return value ? current.set(key, value) : current.delete(key)
      return current.set(key, value.toString())
    })

    const search = current.toString()

    const query = search ? `?${search}` : ''

    startTransition(() => {
      router.push(`${pathname}${query}`, { scroll })
    })
  }

  const updateParam = <Key extends keyof T>(
    name: Key,
    value: T[Key] | ((value: T[Key]) => T[Key]),
    resetPage = false,
    scroll = false
  ) => {
    const update = () => {
      const newParams: typeof params & { page?: number } = {
        ...params,
        [name]: typeof value === 'function' ? value(params[name]) : value
      }
      if (resetPage) newParams.page = 1

      handleURLSearchParams(newParams, scroll)
    }

    if (name === 'search') {
      if (intervalId) clearInterval(intervalId)
      intervalId = setTimeout(() => {
        update()
      }, 500)
    } else {
      update()
    }
  }

  const updateParams = (newParams: Partial<T>, scroll = false) => {
    handleURLSearchParams({ ...params, ...newParams }, scroll)
  }

  return { params, updateParam, updateParams }
}
