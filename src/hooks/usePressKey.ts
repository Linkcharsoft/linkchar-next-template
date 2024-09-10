import { useEffect } from 'react'

const usePressKey = (key: string, callback: () => void) => {
  const handlePressEnterKey = (e: KeyboardEvent) => {
    if (e.key === key) {
      callback()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handlePressEnterKey)
    return () => {
      window.removeEventListener('keydown', handlePressEnterKey)
    }
  })
}

export default usePressKey
