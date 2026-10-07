import { useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { usePwa } from '../app/pwa-store'
import '../styles/pwa.css'
export function AppStatus() {
  const { offline, updateReady, dismissed, error, update } = usePwa()
  const [updating, setUpdating] = useState(false)
  return (
    <div className="app-status">
      <p role="status">
        {offline && (
          <>
            <CloudOff aria-hidden="true" /> Você está offline. Seus registros
            continuam neste navegador.
          </>
        )}
      </p>
      {updateReady && !dismissed && (
        <div className="update-notice" aria-label="Atualização disponível">
          <p role="status">
            Uma nova versão está pronta. Salve formulários abertos antes de
            atualizar; registros e rascunhos salvos serão mantidos.
          </p>
          <div className="button-row">
            <button
              className="button"
              disabled={updating || offline}
              onClick={async () => {
                setUpdating(true)
                try {
                  await update?.()
                } catch {
                  usePwa.setState({
                    error:
                      'A atualização não foi aplicada. Reconecte e tente novamente.',
                  })
                  setUpdating(false)
                }
              }}
            >
              <RefreshCw aria-hidden="true" />
              {updating ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button
              className="button"
              disabled={updating}
              onClick={() => usePwa.setState({ dismissed: true })}
            >
              Agora não
            </button>
          </div>
        </div>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  )
}
