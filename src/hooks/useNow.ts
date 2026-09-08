import { useEffect, useState } from 'react'

/**
 * A clock that re-renders its consumer, for anything whose *appearance*
 * depends on the current time — task urgency, the overdue badge.
 *
 * Deliberately separate from `DashboardProvider`'s `today`, which moves only
 * when the calendar day does. This ticks every minute, and re-anchoring the
 * period that often would move the view under the user's cursor — so this is
 * for urgency only, and must not be wired into the period anchor.
 *
 * A hidden tab stops ticking entirely and takes a fresh reading when it comes
 * back, so a dashboard left open overnight is not waking up once a minute.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const stop = () => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
    }

    const start = () => {
      stop()
      setNow(Date.now())
      timer = setInterval(() => setNow(Date.now()), intervalMs)
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs])

  return now
}
