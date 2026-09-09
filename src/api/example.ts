import { customFetch } from './customFetch'
import type { PaginatedResponseType } from '@/types/general'

export type TestType = {
  id: number
  unread: boolean
  verb: string
  description: string
  timestamp: string
}
export const getTestData = async (path: string = '/notifications', token: string) => {
  return await customFetch<PaginatedResponseType<TestType>>({
    path,
    method: 'GET',
    token
  })
}