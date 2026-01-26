'use client'
import { Toast } from 'primereact/toast'
import { useEffect, useRef } from 'react'
import useModalStore from '@/stores/modalStore'

const ToastNotifications = () => {
  const toastRef = useRef<Toast>(null)
  const { notification, setNotification } = useModalStore()

  useEffect(() => {
    if (notification.summary) {
      toastRef.current?.show(notification)

      // Reset state
      setNotification({ severity: undefined, summary: '' })
    }
  }, [notification])

  return (
    <Toast
      ref={toastRef}
      position='bottom-left'
    />
  )
}

export default ToastNotifications