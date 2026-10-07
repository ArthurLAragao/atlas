import { TransientToast } from '../../components/TransientToast'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { directionHref } from '../../lib/goals'
import { useDirections } from './direction-store'

export function DirectionFeedback() {
  const { error, message, restored, undoInfo, dismiss, undo } = useDirections()
  const busy = useData((state) => state.busy)
  const link = useRef<HTMLAnchorElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const noticeRef = useRef<HTMLParagraphElement>(null)
  if (!error && !message) return null
  return (
    <TransientToast
      identity={`${message}:${error}`}
      persistent={Boolean(error)}
      onDismiss={dismiss}
    >
      {message && (
        <p ref={noticeRef} role="status" tabIndex={-1}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="data-error">
          {error}
        </p>
      )}
      {undoInfo && (
        <button
          ref={undoRef}
          className="button"
          disabled={busy}
          onClick={async () => {
            if (await undo())
              requestAnimationFrame(() =>
                (link.current ?? undoRef.current ?? noticeRef.current)?.focus(),
              )
          }}
        >
          Desfazer: {undoInfo.label}
        </button>
      )}
      {restored && (
        <Link
          data-direction-recovered
          ref={link}
          className="button"
          to={directionHref(restored.type, restored.id)}
          onClick={() =>
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>('main h1')?.focus(),
            )
          }
        >
          Abrir registro recuperado
        </Link>
      )}
      {(error || message) && (
        <button className="button" onClick={dismiss}>
          Fechar aviso de metas e projetos
        </button>
      )}
    </TransientToast>
  )
}
