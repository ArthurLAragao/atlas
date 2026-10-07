import { useRef, useState } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { repository } from '../../data/service'
import { dataError, useData } from '../../app/data-store'
import { useDrafts } from '../notes/draft-store'
import { encodeBackup } from '../../lib/transfer'

export function ClearData() {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const busy = useData((state) => state.busy)
  async function clear() {
    if (lock.current || busy || phrase !== 'APAGAR TUDO' || !understood) return
    lock.current = true
    useData.setState({ busy: true, error: null })
    try {
      const data = await repository.clearAll()
      useDrafts.getState().clearAll()
      useData.setState({ data, canUndo: false, message: '' })
      setOpen(false)
      setNotice(
        useDrafts.getState().error
          ? 'Registros apagados. O navegador bloqueou a remoção dos rascunhos locais; permita armazenamento e tente novamente.'
          : 'Todos os registros e rascunhos foram apagados. Suas preferências foram mantidas.',
      )
    } catch (error) {
      setError(dataError(error))
    } finally {
      lock.current = false
      useData.setState({ busy: false })
    }
  }
  return (
    <>
      <button
        className="button preferences-danger"
        disabled={busy}
        onClick={() => {
          setPhrase('')
          setUnderstood(false)
          setError('')
          setOpen(true)
        }}
      >
        Limpar todos os dados
      </button>
      <p role="status">{notice}</p>
      {open && (
        <EntrySheet
          title="Apagar todos os dados?"
          description="Esta ação apaga registros, sessões, histórico e rascunhos neste navegador. Não pode ser desfeita. Exporte um backup antes; ele poderá ser importado depois."
          onClose={() => {
            if (!lock.current) setOpen(false)
          }}
        >
          <form
            className="preferences-fields"
            onSubmit={(event) => {
              event.preventDefault()
              void clear()
            }}
          >
            <button
              type="button"
              className="button"
              autoFocus
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Manter meus dados
            </button>
            <label>
              Digite APAGAR TUDO
              <input
                type="text"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={async () => {
                try {
                  const blob = new Blob(
                    [encodeBackup(await repository.snapshot())],
                    { type: 'application/json;charset=utf-8' },
                  )
                  const url = URL.createObjectURL(blob),
                    anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = `atlas-backup-${new Date().toISOString().slice(0, 10)}.json`
                  anchor.click()
                  setTimeout(() => URL.revokeObjectURL(url), 30000)
                } catch (error) {
                  setError(dataError(error))
                }
              }}
            >
              Exportar backup antes de limpar
            </button>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
                disabled={busy}
              />
              <span>
                Entendo que a limpeza é irreversível e conferi meu backup.
              </span>
            </label>
            <button
              className="button preferences-danger"
              disabled={busy || phrase !== 'APAGAR TUDO' || !understood}
            >
              Apagar definitivamente
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </EntrySheet>
      )}
    </>
  )
}
