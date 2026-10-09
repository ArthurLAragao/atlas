import { useEffect, useState } from 'react'

/** Refresh the local day after midnight and after returning to the app. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let midnight: number
    const scheduleMidnight = () => {
      window.clearTimeout(midnight)
      const current = new Date()
      const next = new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() + 1,
      )
      midnight = window.setTimeout(
        refresh,
        Math.max(1, next.getTime() - current.getTime()),
      )
    }
    const refresh = () => {
      setNow(new Date())
      scheduleMidnight()
    }
    scheduleMidnight()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(midnight)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return now
}
