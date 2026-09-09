export type PaginatedResponseType<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type StateTypes = 'success' | 'info' | 'warn' | 'error'
