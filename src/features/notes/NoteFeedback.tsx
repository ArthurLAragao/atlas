import { TransientToast } from '../../components/TransientToast'
import { useNotes } from './note-store'
import { useData } from '../../app/data-store'
import { useRef } from 'react'
import { Link } from 'react-router-dom'
export function NoteFeedback() {
  const { message, error, canUndo, restoredId, dismiss, undo } = useNotes()
  const shownMessage = message === 'Nota salva.' ? '' : message
  const busy = useData((state) => state.busy)
  const restored = useData((state) =>
    state.data.notes.find((note) => note.id === restoredId),
  )
  const recoveredLink = useRef<HTMLAnchorElement>(null)
  const undoButton = useRef<HTMLButtonElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  async function handleUndo() {
    if (await undo())
      requestAnimationFrame(() =>
        (
          recoveredLink.current ??
          undoButton.current ??
          status.current
        )?.focus(),
      )
  }
  if (!shownMessage && !error) return null
  return (
    <TransientToast
      identity={`${message}:${error}`}
      persistent={Boolean(error)}
      onDismiss={dismiss}
    >
      {shownMessage && (
        <p ref={status} role="status" tabIndex={-1}>
          {shownMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="data-error">
          {error}
        </p>
      )}
      {canUndo && (
        <button
          ref={undoButton}
          className="button"
          disabled={busy}
          onClick={() => void handleUndo()}
        >
          Desfazer última ação em notas
        </button>
      )}
      {restored && (
        <Link
          data-note-recovered
          ref={recoveredLink}
          className="button"
          to={`/notas?note=${restored.id}${restored.archivedAt ? '' : '&edit=1'}`}
        >
          Abrir nota recuperada: {restored.title}
        </Link>
      )}
      {(shownMessage || error) && (
        <button className="button" onClick={dismiss}>
          Fechar aviso de notas
        </button>
      )}
    </TransientToast>
  )
}
