'use client'
import { create } from 'zustand'
import type { StateTypes } from '@/types/general'
import type { ToastMessage } from 'primereact/toast'

// * Base Type
type ModalStateBase<T> = T & {
  show: boolean
}

// * Modal Types
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

// * Modal payloads
type ModalPayloads = {
  loadingModal: LoadingModal
  stateModal: StateModal
}

// * Modal map
type ModalStateMap = {
  [key in keyof ModalPayloads]: ModalStateBase<ModalPayloads[key]>
}

interface ModalStore {
  modals: ModalStateMap
  openModal: <K extends keyof ModalPayloads>(key: K, payload: Omit<ModalPayloads[K], 'show'>) => void
  closeModal: <K extends keyof ModalPayloads>(key: K) => void
  // closeAllModals: () => void

  notification: ToastMessage
  setNotification: (notification: {
    severity: Exclude<ToastMessage['severity'], 'secondary' | 'contrast'>
    summary: ToastMessage['summary']
    detail?: ToastMessage['detail']
    life?: number
    sticky?: boolean
  }) => void
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
  // closeAllModals: () => {
  //   set((state) => ({
  //     modals: Object.keys(state.modals).reduce((acc, curr) => {
  //       acc[curr as keyof ModalStateMap] = {
  //         ...state.modals[curr as keyof ModalStateMap],
  //         show: false
  //       }
  //       return acc
  //     }, {} as ModalStateMap)
  //   }))
  // }

  notification: {
    severity: 'info',
    summary: ''
  },
  setNotification: (notification) =>
    set(() => ({
      notification: {
        ...notification,
        life: notification.life ?? 3000
      }
    }))
}))

export default useModalStore