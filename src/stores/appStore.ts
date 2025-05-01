'use client'
import { ToastMessage } from 'primereact/toast'
import { create } from 'zustand'

type LoadingModalState = {
  show: boolean
  title: string
  message: string
}

type ModalState = {
  show: boolean
  type: 'success' | 'info' | 'warning' | 'error'
  header: string
  content: string
}

interface AppState {
  loadingModal: LoadingModalState
  showLoadingModal: (params: { title?: string, message?: string }) => void
  hideLoadingModal: () => void

  modalState: ModalState
  showModalState: (type: 'success' | 'info' | 'warning' | 'error', header: string, content: string) => void
  hideModalState: () => void

  toastMessage: ToastMessage
  setToastMessage: (message: ToastMessage) => void
}

// Create Zustand store
export const useAppStore = create<AppState>((set) => ({
  loadingModal: {
    show: false,
    title: '',
    message: ''
  },
  showLoadingModal: ({ title = '', message = '' }) =>
    set((state) => ({
      loadingModal: {
        ...state.loadingModal,
        show: true,
        title,
        message,
      }
    })),
  hideLoadingModal: () =>
    set(() => ({
      loadingModal: {
        show: false,
        title: '',
        message: ''
      }
    })),

  modalState: {
    show: false,
    type: 'success',
    header: '',
    content: ''
  },
  showModalState: (type, header, content) =>
    set(() => ({
      modalState: {
        show: true,
        type,
        header,
        content
      }
    })),
  hideModalState: () =>
    set(() => ({
      modalState: {
        show: false,
        type: 'success',
        header: '',
        content: ''
      }
    })),

  toastMessage: {
    severity: 'info',
    summary: ''
  },
  setToastMessage: (message) =>
    set(() => ({
      toastMessage: message
    }))
}))
