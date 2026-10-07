import * as Dialog from '@radix-ui/react-dialog'
import { Database, X } from 'lucide-react'
import { useData } from '../app/data-store'
import { lazy, Suspense, useState } from 'react'
import { DataFeedback } from './DataFeedback'
import { createPortal } from 'react-dom'

const DataPanelBody = lazy(() =>
  import('./DataPanelBody').then((module) => ({
    default: module.DataPanelBody,
  })),
)

export function DataPanel() {
  const [open, setOpen] = useState(false)
  const busy = useData((state) => state.busy)
  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button className="button" aria-label="Seus dados">
            <Database aria-hidden="true" />
            <span>Seus dados</span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay" />
          <Dialog.Content className="data-sheet" aria-busy={busy}>
            <header className="sheet-header glass">
              <Dialog.Title>Seus dados</Dialog.Title>
              <Dialog.Close
                className="icon-button"
                aria-label="Fechar seus dados"
              >
                <X aria-hidden="true" />
              </Dialog.Close>
            </header>
            <div className="sheet-body">
              <Dialog.Description>
                Seus registros ficam neste navegador, neste endereço. Exporte
                uma cópia antes de limpar os dados do navegador ou mudar de
                dispositivo.
              </Dialog.Description>
              <Suspense
                fallback={<p role="status">Preparando ações de dados.</p>}
              >
                <DataPanelBody />
              </Suspense>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!open && createPortal(<DataFeedback floating />, document.body)}
    </>
  )
}
