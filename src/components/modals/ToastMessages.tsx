'use client'
import { useEffect, useRef } from 'react'
import { Toast } from 'primereact/toast'
import useAppContext from '@/hooks/useAppContext'

const ToastMessages = () => {
  const toastRef = useRef<Toast>(null)
  const { toastMessage, setToastMessage } = useAppContext()

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