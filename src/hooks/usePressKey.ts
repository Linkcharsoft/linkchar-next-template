import { useEffect } from 'react'

const usePressKey = (key: string, callback: () => void) => {
  const handlePressEnterKey = (e: KeyboardEvent) => {
    if (e.key === key) {
      callback()
    }
  }

  useEffect(() => {
    globalThis.addEventListener('keydown', handlePressEnterKey)
    return () => {
      globalThis.removeEventListener('keydown', handlePressEnterKey)
    }
  }, [key, callback])
}

export default usePressKey
