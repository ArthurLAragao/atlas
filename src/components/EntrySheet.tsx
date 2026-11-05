import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode, type RefObject } from 'react'

export function EntrySheet({
  title,
  description,
  onClose,
  children,
  initialFocus,
  className = '',
  dismissDisabled = false,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
  dismissDisabled?: boolean
}) {
  const previous = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !dismissDisabled) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className={`data-sheet ${className}`}
          onEscapeKeyDown={(event) => {
            if (dismissDisabled) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (dismissDisabled) event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            if (initialFocus?.current) {
              event.preventDefault()
              initialFocus.current.focus()
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (previous.current?.isConnected) previous.current.focus()
            else
              document
                .querySelector<HTMLButtonElement>('[data-new-task]')
                ?.focus()
          }}
        >
          <header className="sheet-header glass">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close
              className="icon-button"
              aria-label="Fechar"
              disabled={dismissDisabled}
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </header>
          <div className="sheet-body">
            <Dialog.Description>{description}</Dialog.Description>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
