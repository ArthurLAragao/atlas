import { useEffect, useRef } from 'react'

/** A confirmed write must not navigate or close another view after dismissal. */
export function useActiveForm() {
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return active
}
