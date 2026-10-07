import { useRef, useState } from 'react'
import { dataError, useData } from '../app/data-store'
import { repository } from '../data/service'
import { type Snapshot } from '../data/models'
import {
  encodeBackup,
  encodeMarkdown,
  importSummary,
  maxImportBytes,
  maxBackupBytes,
  parseImport,
} from '../lib/transfer'
import { mergeSnapshots } from '../lib/data-records'
import { MarkdownImportButton } from './MarkdownImportButton'

function download(text: string, format: 'json' | 'md') {
  const url = URL.createObjectURL(
    new Blob([text], {
      type:
        format === 'json'
          ? 'application/json;charset=utf-8'
          : 'text/markdown;charset=utf-8',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `atlas-${new Date().toISOString().slice(0, 10)}.${format}`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Delay revocation so browsers have time to start the local download.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function DataTransfer() {
  const [pending, setPending] = useState<Snapshot | null>(null)
  const [filename, setFilename] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const importData = useData((state) => state.importData)
  let preview: { added: number; skipped: number } | undefined
  let conflict = ''
  if (pending) {
    try {
      preview = mergeSnapshots(data, pending)
    } catch (error) {
      conflict = dataError(error)
    }
  }
  async function selectFile(file?: File) {
    const version = ++request.current
    setPending(null)
    setError('')
    setNotice('')
    setFilename(file?.name ?? '')
    if (!file) return
    setReading(true)
    try {
      const limit = /\.json$/i.test(file.name) ? maxBackupBytes : maxImportBytes
      if (file.size > limit)
        throw new Error(
          `O limite é ${limit / 1024 / 1024} MB por arquivo. Divida o conteúdo e tente novamente.`,
        )
      const parsed = parseImport(await file.text(), file.name)
      if (version === request.current) {
        setPending(parsed)
        setFilename(file.name)
      }
    } catch (error) {
      if (version === request.current) setError(dataError(error))
    } finally {
      if (version === request.current) setReading(false)
    }
  }
  async function exportData(format: 'json' | 'md') {
    setError('')
    try {
      const snapshot = await repository.snapshot()
      download(
        format === 'json' ? encodeBackup(snapshot) : encodeMarkdown(snapshot),
        format,
      )
      setNotice('Arquivo preparado. Confira os downloads do navegador.')
    } catch (error) {
      setError(dataError(error))
    }
  }
  return (
    <>
      <section className="data-section" aria-labelledby="export-title">
        <h3 id="export-title">Leve seus dados com você</h3>
        <p>
          JSON é o backup completo. Markdown inclui uma leitura e um bloco de
          restauração dos mesmos dados. Preferências de aparência não estão
          incluídas.
        </p>
        <div className="button-row">
          <button
            className="button"
            disabled={busy}
            onClick={() => void exportData('json')}
          >
            Exportar JSON
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => void exportData('md')}
          >
            Exportar Markdown
          </button>
        </div>
      </section>
      <section className="data-section" aria-labelledby="import-title">
        <h3 id="import-title">Importar uma cópia ou nota</h3>
        <MarkdownImportButton />
        <p id="file-help">
          Escolha JSON até 50 MB ou Markdown até 5 MB. Uma nota .md comum vira
          uma nova nota; backups Atlas restauram todos os tipos. Nada existente
          será sobrescrito.
        </p>
        <div className="file-label">
          <span id="file-label">Arquivo para importar</span>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,.md,.markdown"
            aria-labelledby="file-label"
            aria-describedby="file-help"
            disabled={busy || reading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void selectFile(file)
            }}
          />
          <button
            className="button"
            disabled={busy || reading}
            onClick={() => fileInput.current?.click()}
          >
            Escolher arquivo
          </button>
          <p className="caption">{filename || 'Nenhum arquivo selecionado'}</p>
        </div>
        {reading && <p role="status">Conferindo arquivo…</p>}
        {pending && (
          <div className="import-preview">
            <h3>Prévia: {filename}</h3>
            <p>{importSummary(pending)}</p>
            {preview && (
              <p>
                {preview.added} novos · {preview.skipped} existentes serão
                preservados.
              </p>
            )}
            <p className="caption">
              A importação será conferida novamente ao confirmar.
            </p>
            <div className="button-row">
              <button
                className="button"
                disabled={busy || Boolean(conflict)}
                onClick={async () => {
                  if (await importData(pending)) setPending(null)
                }}
              >
                {busy ? 'Importando…' : 'Confirmar importação'}
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => {
                  setPending(null)
                  setError('')
                }}
              >
                Cancelar importação
              </button>
            </div>
          </div>
        )}
        {(error || conflict) && (
          <p className="data-error" role="alert">
            {error || conflict}
          </p>
        )}
        <p role="status">{notice}</p>
      </section>
    </>
  )
}
