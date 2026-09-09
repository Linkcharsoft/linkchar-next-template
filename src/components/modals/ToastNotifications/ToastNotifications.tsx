'use client'
import './ToastNotifications.sass'
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
  const notifications = useModalStore((s) => s.notifications)
  const clearNotifications = useModalStore((s) => s.clearNotifications)
  const isMobile = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    if (notifications.length === 0) return

    toastRef.current?.show(notifications.map((notification) => ({
      ...notification,
      icon: `${STATE_ICONS[notification.severity]} ${isMobile ? 'text-regular-24' : 'text-regular-28'}`
    })))
    clearNotifications()
  }, [notifications, clearNotifications, isMobile])

  return (
    <Toast
      ref={toastRef}
      position='bottom-left'
    />
  )
}

export default ToastNotifications
