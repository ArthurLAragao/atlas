import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Timing affects presentation only. Repository undo data is never expired here. */
export function TransientToast({
  children,
  identity,
  onDismiss,
  persistent = false,
}: {
  children: ReactNode
  identity: string
  onDismiss?: () => void
  persistent?: boolean
}) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  const visible = dismissed !== identity
  const [paused, setPaused] = useState(false)
  const element = useRef<HTMLDivElement>(null)
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])
  useEffect(() => {
    const visibility = () =>
      setPaused(
        document.hidden ||
          Boolean(element.current?.contains(document.activeElement)),
      )
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])
  useEffect(() => {
    if (paused || persistent || !visible) return
    const timer = window.setTimeout(() => {
      setDismissed(identity)
      dismiss.current?.()
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [identity, paused, persistent, visible])
  if (!visible) return null
  return createPortal(
    <div
      ref={element}
      className="transient-toast"
      data-toast
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() =>
        setPaused(Boolean(element.current?.contains(document.activeElement)))
      }
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
      }}
    >
      {children}
    </div>,
    document.getElementById('toast-viewport') ?? document.body,
  )
}
