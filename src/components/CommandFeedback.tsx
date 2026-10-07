import { useCommands } from '../app/command-store'
import { TransientToast } from './TransientToast'

export function CommandFeedback() {
  const message = useCommands((state) => state.message)
  const error = useCommands((state) => state.error)
  if (!message && !error) return null
  return (
    <TransientToast
      identity={`${message}:${error}`}
      persistent={Boolean(error)}
      onDismiss={() => useCommands.getState().dismissFeedback()}
    >
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="data-error" role="alert">
          {error}
        </p>
      )}
      {error && (
        <button
          className="button"
          onClick={() =>
            useCommands
              .getState()
              .openPalette(useCommands.getState().recoveryQuery)
          }
        >
          Tentar captura novamente
        </button>
      )}
      <button
        className="button"
        onClick={() => useCommands.getState().dismissFeedback()}
      >
        Fechar aviso de captura
      </button>
    </TransientToast>
  )
}
