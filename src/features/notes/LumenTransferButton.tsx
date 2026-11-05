import { lazy, Suspense, useState } from 'react'

const LumenTransferDialog = lazy(() => import('./LumenTransferDialog'))
export function LumenTransferButton() {
  const [mode, setMode] = useState<'import' | 'history' | null>(null)
  return (
    <>
      <button className="button" onClick={() => setMode('import')}>
        Importar do Lumen
      </button>
      <button className="button" onClick={() => setMode('history')}>
        Histórico Lumen
      </button>
      {mode && (
        <Suspense fallback={<p role="status">Abrindo transferência Lumen…</p>}>
          <LumenTransferDialog mode={mode} onClose={() => setMode(null)} />
        </Suspense>
      )}
    </>
  )
}
