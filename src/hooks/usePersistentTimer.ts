'use client'
import { useEffect } from 'react'
import { useSessionStorage } from 'usehooks-ts'

/**
 * @hook
 * @name usePersistentTimer
 * @description Custom hook that implements a persistent countdown timer.
 * The timer's value is saved and retrieved from Session Storage, allowing the
 * countdown to continue even after refreshing the page or navigating to other tabs
 * (as long as the session remains active).
 *
 *
 * @example
 * ```tsx
 * const {
 *  timer,
 *  startTimer,
 *  stopTimer,
 *  timerIsRunning
 * } = usePersistentTimer({
 *  storageKey: 'session-timeout',
 *  time: 30,
 *  initialTime: 0
 * })
 * ```
 */

const usePersistentTimer = ({
  storageKey,
  time,
  initialTime = 0
}: {
  storageKey: string
  time: number
  initialTime?: number
}): {
  timer: number
  startTimer: () => void
  stopTimer: () => void
  timerIsRunning: boolean
} => {
  const [timer, setTimer] = useSessionStorage<number>(storageKey, initialTime)

  useEffect(() => {
    if (timer <= 0) return

    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timer, setTimer])

  const startTimer = () => {
    setTimer(time)
  }

  const stopTimer = () => {
    setTimer(0)
  }

  return {
    timer,
    startTimer,
    stopTimer,
    timerIsRunning: timer > 0
  }
}

export default usePersistentTimer