import { create } from 'zustand'
import type { UserType } from '@/types/auth'

type UserStoreType = {
  user?: UserType
  setUser: (user: UserType) => void
  removeUser: () => void

  token?: string
  setToken: (token: string) => void
  removeToken: () => void
}

const useUserStore = create<UserStoreType>((set) => ({
  user: undefined,
  setUser: (user: UserType) => set({ user }),
  removeUser: () => set({ user: undefined }),

  token: undefined,
  setToken: (token: string) => set({ token }),
  removeToken: () => set({ token: undefined })
}))

export default useUserStore