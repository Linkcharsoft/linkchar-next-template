'use client'
import { Toast } from 'primereact/toast'
import { useEffect, useRef } from 'react'
import useModalStore from '@/stores/modalStore'

const ToastMessages = () => {
  const toastRef = useRef<Toast>(null)
  const { toastMessage, setToastMessage } = useModalStore()

  useEffect(() => {
    if (toastMessage.summary) {
      toastRef.current?.show(toastMessage)
      setToastMessage({
        severity: 'info',
        summary: ''
      })
    }
  }, [toastMessage])

  return (
    <Toast
      ref={toastRef}
      position='bottom-left'
    />
  )
}

export default ToastMessages