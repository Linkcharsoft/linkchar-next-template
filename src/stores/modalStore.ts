import { create } from 'zustand'
import type { StateTypes } from '@/types/general'
import type { ToastMessage } from 'primereact/toast'

type ModalStateBase<T> = T & {
  show: boolean
}

type LoadingModal = {
  title: string
  subtitle?: string
  content?: string
}
type StateModal = {
  type: StateTypes
  title: string
  subtitle?: string
  content: string
  button?: {
    label?: string
    action: () => void
  }
}

type ModalPayloads = {
  loadingModal: LoadingModal
  stateModal: StateModal
}

type ModalStateMap = {
  [key in keyof ModalPayloads]: ModalStateBase<ModalPayloads[key]>
}

type NotificationType = {
  severity: StateTypes
  summary: ToastMessage['summary']
  detail?: ToastMessage['detail']
  life?: number
  sticky?: boolean
}

interface ModalStore {
  modals: ModalStateMap
  openModal: <K extends keyof ModalPayloads>(key: K, payload: Omit<ModalPayloads[K], 'show'>) => void
  closeModal: <K extends keyof ModalPayloads>(key: K) => void
  closeAllModals: () => void

  // A queue, not a slot: two notifications fired in the same tick must both reach the toast.
  notifications: NotificationType[]
  setNotification: (notification: NotificationType) => void
  clearNotifications: () => void
}

const initialModals: ModalStateMap = {
  loadingModal: {
    show: false,
    title: '',
    subtitle: '',
    content: ''
  },
  stateModal: {
    show: false,
    type: 'success',
    title: '',
    subtitle: '',
    content: ''
  }
}

const useModalStore = create<ModalStore>((set) => ({
  modals: initialModals,
  openModal: (key, payload) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [key]: {
          ...state.modals[key],
          ...payload,
          show: true
        }
      }
    })),
  closeModal: (key) =>
    set((state) => ({
      modals: {
        ...state.modals,
        [key]: {
          ...state.modals[key],
          show: false
        }
      }
    })),
  closeAllModals: () => {
    set((state) => ({
      modals: Object.fromEntries(
        (Object.entries(state.modals) as [keyof ModalStateMap, ModalStateMap[keyof ModalStateMap]][]).map(
          ([key, value]) => [
            key,
            { ...value, show: false }
          ]
        )
      ) as ModalStateMap
    }))
  },

  notifications: [],
  setNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, { ...notification, life: notification.life ?? 5000 }]
    })),
  clearNotifications: () => set({ notifications: [] })
}))

export default useModalStore
