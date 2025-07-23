import { create } from 'zustand'
import { UserType } from '@/types/auth'

type UserStoreType = {
  user?: UserType
  setUser: (user: UserType) => void
  removeUser: () => void
}

const useUserStore = create<UserStoreType>((set) => ({
  user: undefined,
  setUser: (user: UserType) => set({ user }),
  removeUser: () => set({ user: undefined })
}))

export default useUserStore