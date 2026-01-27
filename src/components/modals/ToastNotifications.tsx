'use client'
import { Toast } from 'primereact/toast'
import { useEffect, useRef } from 'react'
import { useMediaQuery } from 'usehooks-ts'
import useModalStore from '@/stores/modalStore'
import type { StateTypes } from '@/types/general'

const STATE_ICONS: {
  [K in StateTypes]: string
} = {
  success: 'pi pi-check-circle',
  info: 'pi pi-info-circle',
  warn: 'pi pi-exclamation-triangle',
  error: 'pi pi-times-circle'
}


const ToastNotifications = () => {
  const toastRef = useRef<Toast>(null)
  const { notification, setNotification } = useModalStore()
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    if (notification.summary) {
      toastRef.current?.show({
        ...notification,
        icon: `${STATE_ICONS[notification.severity!]} ${isMobile ? 'text-24' : 'text-28'}`
      })

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