import { createContext, useState } from 'react'

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

export interface AppContextType {
  loadingModal: LoadingModalState
  showLoadingModal: (title: string, message: string) => void
  hideLoadingModal: () => void

  modalState: ModalState
  showModalState: (type: 'success' | 'info' | 'warning' | 'error', header: string, content: string) => void
  hideModalState: () => void
}

export const AppContext = createContext<AppContextType | null>(null)

interface Props {
  children: React.ReactNode
}


const AppContextProvider = ({ children }: Props) => {
  const [loadingModal, setLoadingModal] = useState<LoadingModalState>({
    show: false,
    title: '',
    message: ''
  })

  const [modalState, setModalState] = useState<ModalState>({
    show: false,
    type: 'success',
    header: '',
    content: ''
  })

  const showLoadingModal = (title: string, message: string) => {
    setLoadingModal({
      show: true,
      title,
      message
    })
  }

  const hideLoadingModal = () => {
    setLoadingModal({
      show: false,
      title: '',
      message: ''
    })
  }

  const showModalState = (type: 'success' | 'info' | 'warning' | 'error', header: string, content: string) => {
    setModalState({
      show: true,
      type,
      header,
      content
    })
  }

  const hideModalState = () => {
    setModalState({
      show: false,
      type: 'success',
      header: '',
      content: ''
    })
  }

  const contextValue: AppContextType = {
    loadingModal,
    showLoadingModal,
    hideLoadingModal,
    
    modalState,
    showModalState,
    hideModalState
  }

  return (
    <AppContext.Provider value={contextValue}>
      { children }
    </AppContext.Provider>
  )
}

export default AppContextProvider