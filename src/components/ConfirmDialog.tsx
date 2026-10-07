import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import { TriangleAlert, Trash2 } from 'lucide-react'
import { dataError } from '../app/data-store'

export function ConfirmDialog({
  title,
  name,
  description,
  action = 'Excluir',
  onConfirm,
  onCancel,
  restoreFocus,
}: {
  title: string
  name: string
  description: string
  action?: string
  onConfirm: () => Promise<boolean | void> | boolean | void
  onCancel: () => void
  restoreFocus?: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  const previous = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      if ((await onConfirm()) !== false) onCancel()
      else
        setError(
          'Não foi possível concluir. Cancele para revisar o aviso e tente novamente.',
        )
    } catch (error) {
      setError(dataError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          role="alertdialog"
          className="data-sheet confirm-dialog"
          onKeyDown={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancel.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (restoreFocus) restoreFocus()
            else if (previous.current?.isConnected) previous.current.focus()
            else
              (
                document.querySelector<HTMLElement>('[data-new-task]') ??
                document.querySelector<HTMLElement>('main h1')
              )?.focus()
          }}
        >
          <div className="sheet-body">
            <TriangleAlert aria-hidden="true" />
            <Dialog.Title>{title}</Dialog.Title>
            <p className="confirm-name">{name}</p>
            <Dialog.Description>{description}</Dialog.Description>
            {error && (
              <p role="alert" className="data-error">
                {error}
              </p>
            )}
            <div className="button-row">
              <button
                ref={cancel}
                className="button"
                disabled={busy}
                onClick={onCancel}
              >
                Cancelar
              </button>
              <button
                className="button task-danger"
                disabled={busy}
                onClick={() => void confirm()}
              >
                <Trash2 aria-hidden="true" />
                {busy ? 'Aguarde…' : action}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
