import { TransientToast } from './TransientToast'
import { useData } from '../app/data-store'
import { useState } from 'react'

export function DataFeedback({ floating = false }: { floating?: boolean }) {
  const [dismissed, dismiss] = useState<string | null>(null)
  const message = useData((state) => state.message)
  const error = useData((state) => state.error)
  const canUndo = useData((state) => state.canUndo)
  const busy = useData((state) => state.busy)
  const undo = useData((state) => state.undoExamples)
  const noticeKey = `${message}:${error}:${canUndo}`
  if (floating && dismissed === noticeKey) return null
  if (!message && !error && !canUndo) return null
  const content = (
    <div className="data-feedback">
      <p role="status">
        {message ||
          (canUndo ? 'A remoção dos exemplos pode ser desfeita.' : '')}
      </p>
      {error && (
        <p className="data-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        {canUndo && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void undo()}
          >
            Desfazer remoção
          </button>
        )}
        {floating && (
          <button className="button" onClick={() => dismiss(noticeKey)}>
            Fechar aviso
          </button>
        )}
      </div>
    </div>
  )
  return floating ? (
    <TransientToast
      identity={noticeKey}
      persistent={Boolean(error)}
      onDismiss={() => dismiss(noticeKey)}
    >
      {content}
    </TransientToast>
  ) : (
    content
  )
}
