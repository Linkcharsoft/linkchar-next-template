'use client'
import { useEffect, useState } from 'react'
import { useSessionStorage } from 'usehooks-ts'

/**
 * @hook
 * @name usePersistentTimer
 * @description Persistent countdown timer. Session Storage holds the deadline (epoch ms), not the
 * remaining seconds, so time keeps elapsing across refreshes and while the tab is in the background.
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

const secondsLeft = (deadline: number, now: number): number => Math.max(0, Math.ceil((deadline - now) / 1000))

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
  // null = never started in this session; the initial countdown is persisted on mount so a reload continues it.
  const [deadline, setDeadline] = useSessionStorage<number | null>(storageKey, null)
  const [now, setNow] = useState(() => Date.now())
  const timer = secondsLeft(deadline ?? 0, now)
  const isRunning = timer > 0

  useEffect(() => {
    if (deadline === null && initialTime > 0) setDeadline(Date.now() + initialTime * 1000)
  }, [deadline, initialTime, setDeadline])

  useEffect(() => {
    if (!isRunning) return

    const tick = () => setNow(Date.now())
    // Immediate tick: the deadline may have been written after `now` was captured on first render.
    const firstTick = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(firstTick)
      clearInterval(interval)
    }
  }, [isRunning])

  const startTimer = () => {
    const startedAt = Date.now()
    setNow(startedAt)
    setDeadline(startedAt + time * 1000)
  }
  const stopTimer = () => setDeadline(0)

  return {
    timer,
    startTimer,
    stopTimer,
    timerIsRunning: isRunning
  }
}

export default usePersistentTimer
