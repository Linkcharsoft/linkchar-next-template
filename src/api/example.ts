import { customFetch } from './customFetch'
import type { PaginatedResponse } from '@/types/general'

export type TestType = {
  id: number
  unread: boolean
  verb: string
  description: string
  timestamp: string
}
export const getTestData = async (path: string = '/notifications', token: string) => {
  return await customFetch<PaginatedResponse<Array<TestType>>>({
    path,
    method: 'GET',
    token
  })
}