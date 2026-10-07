import { useMemo, useRef, useState } from 'react'
import { FileText, Upload, Check, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EntrySheet } from '../../components/EntrySheet'
import { ConfirmAction } from '../../components/ConfirmAction'
import { dataError, useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Note } from '../../data/models'
import {
  parseMarkdownNote,
  planMarkdownImport,
  validateMarkdownFiles,
  validateMarkdownFile,
  type DuplicatePolicy,
} from '../../lib/markdown-import'
import { MarkdownPreview } from './MarkdownPreview'
import '../../styles/markdown-import.css'
import '../../styles/notes.css'
interface Selected {
  key: string
  name: string
  size: number
  note?: Note
  warnings: string[]
  error?: string
}
export function MarkdownImport({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null),
    dropzone = useRef<HTMLButtonElement>(null),
    version = useRef(0)
  const [files, setFiles] = useState<Selected[]>([]),
    [reading, setReading] = useState(false),
    [drag, setDrag] = useState(false),
    [error, setError] = useState(''),
    [policy, setPolicy] = useState<DuplicatePolicy>('ask'),
    [result, setResult] = useState<{
      notes: Note[]
      skipped: number
      failed: number
    } | null>(null)
  const data = useData((s) => s.data),
    busy = useData((s) => s.busy)
  const notes = useMemo(
    () => files.flatMap((file) => (file.note ? [file.note] : [])),
    [files],
  )
  const plan = useMemo(
    () => planMarkdownImport(notes, data, 'ignore', []),
    [notes, data],
  )
  const planned = policy === 'copy' ? notes.length : plan.imported.length
  async function select(selected: File[]) {
    if (busy) return
    const request = ++version.current
    setReading(true)
    setError('')
    setResult(null)
    setPolicy('ask')
    setFiles([])
    try {
      validateMarkdownFiles(selected)
      const read: Selected[] = []
      for (const file of selected) {
        const item: Selected = {
          key: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          warnings: [],
        }
        try {
          validateMarkdownFile(file)
          const source = new TextDecoder('utf-8', { fatal: true }).decode(
            await file.arrayBuffer(),
          )
          const parsed = parseMarkdownNote(
            source,
            file.name,
            new Date().toISOString(),
            crypto.randomUUID(),
          )
          item.note = parsed.note
          item.warnings = parsed.warnings
        } catch (error) {
          item.error =
            error instanceof TypeError
              ? 'Arquivo ilegível. Salve o texto como UTF-8 e tente novamente.'
              : dataError(error)
        }
        read.push(item)
      }
      if (request === version.current) setFiles(read)
    } catch (error) {
      if (request === version.current) setError(dataError(error))
    } finally {
      if (request === version.current) {
        setReading(false)
        if (input.current) input.current.value = ''
      }
    }
  }
  async function importNotes() {
    if (
      busy ||
      reading ||
      !notes.length ||
      (policy === 'ask' && plan.duplicates.length)
    )
      return
    useData.setState({ busy: true })
    setError('')
    try {
      const imported = await repository.importMarkdownNotes(notes, policy)
      useData.setState({ data: imported.data })
      setResult({
        notes: imported.imported,
        skipped: imported.skipped,
        failed: files.filter((f) => f.error).length,
      })
      setFiles([])
    } catch (error) {
      setError(dataError(error))
      useData.setState({ data: await repository.snapshot().catch(() => data) })
    } finally {
      useData.setState({ busy: false })
    }
  }
  function close() {
    if (busy) return
    version.current++
    onClose()
  }
  return (
    <EntrySheet
      title="Importar Markdown"
      description="Arquivos locais viram notas. Nada é enviado para serviços externos."
      onClose={close}
      initialFocus={dropzone}
    >
      {result ? (
        <div className="markdown-import-result">
          <p role="status">
            {result.notes.length} importadas · {result.skipped} ignoradas ·{' '}
            {result.failed} falhas.
          </p>
          <ul>
            {result.notes.map((note) => (
              <li key={note.id}>
                <Link
                  className="button"
                  to={`/notas?note=${note.id}&edit=1`}
                  onClick={close}
                >
                  Abrir {note.title}
                </Link>
              </li>
            ))}
          </ul>
          <button className="button" onClick={close}>
            Concluir importação
          </button>
        </div>
      ) : (
        <>
          <label className="sr-only">
            Arquivos Markdown
            <input
              ref={input}
              type="file"
              accept=".md,text/markdown,text/plain"
              multiple
              disabled={busy || reading}
              onChange={(e) => void select(Array.from(e.target.files ?? []))}
            />
          </label>
          <button
            ref={dropzone}
            type="button"
            className="markdown-dropzone"
            data-drag={drag}
            disabled={busy || reading}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              void select(Array.from(e.dataTransfer.files))
            }}
          >
            <Upload aria-hidden="true" />
            <strong>
              {drag
                ? 'Solte para preparar as notas'
                : 'Arraste arquivos Markdown aqui'}
            </strong>
            <span>ou selecione arquivos do dispositivo</span>
            <span className="button">Selecionar arquivos</span>
          </button>
          <p className="form-help">
            Somente .md · até 20 arquivos · 1 MB por arquivo · 10 MB por
            operação. Sem imagens, anexos ou HTML ativo. Texto UTF-8; até
            500.000 caracteres por nota.
          </p>
          <details>
            <summary>Como as notas serão criadas</summary>
            <p className="form-help">
              Título do frontmatter ou primeiro # título. Sem título, usamos o
              nome do arquivo. Reconhecemos id, title, tags e archivedAt; outros
              metadados ficam no texto. [[Links internos]] são preservados. Sem
              execução de HTML, scripts ou imagens.
            </p>
          </details>
          <p role="status" aria-live="polite">
            {reading
              ? 'Lendo e validando os arquivos…'
              : `${notes.length} notas válidas · ${files.filter((f) => f.error).length} arquivos com falha · ${plan.duplicates.length} duplicadas.`}
          </p>
          <ul className="markdown-files">
            {files.map((file, index) => (
              <li key={file.key}>
                <div className="markdown-file-heading">
                  <FileText aria-hidden="true" />
                  <div>
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1024).toLocaleString('pt-BR', {
                        maximumFractionDigits: 1,
                      })}{' '}
                      KB
                    </span>
                  </div>
                  <ConfirmAction
                    className="button"
                    disabled={busy || reading}
                    aria-label={`Remover ${file.name} da seleção`}
                    title="Retirar este arquivo da seleção?"
                    name={file.name}
                    description="A nota ainda não foi importada. O arquivo original continua no seu dispositivo."
                    restoreFocus={() => dropzone.current?.focus()}
                    onConfirm={() =>
                      setFiles((current) =>
                        current.filter((f) => f.key !== file.key),
                      )
                    }
                  >
                    Remover
                  </ConfirmAction>
                </div>
                {file.error ? (
                  <p className="data-error">
                    <TriangleAlert aria-hidden="true" />
                    {file.error}
                  </p>
                ) : (
                  <>
                    <p>
                      <Check aria-hidden="true" />
                      Pronta: {file.note?.title}
                    </p>
                    <p className="form-help">
                      {file.note?.tags.map((t) => `#${t}`).join(' ')}
                    </p>
                    {file.warnings.map((w) => (
                      <p className="form-help" key={w}>
                        {w}
                      </p>
                    ))}
                    {index < 3 && file.note && (
                      <details>
                        <summary>Prévia curta</summary>
                        <MarkdownPreview
                          content={file.note.content.slice(0, 600)}
                          notes={[...data.notes, ...notes]}
                        />
                      </details>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {plan.duplicates.length > 0 && (
            <label className="task-field">
              Notas duplicadas
              <select
                value={policy}
                disabled={busy}
                onChange={(e) => setPolicy(e.target.value as DuplicatePolicy)}
              >
                <option value="ask">Escolha como continuar</option>
                <option value="ignore">Ignorar duplicadas</option>
                <option value="copy">Importar como cópia</option>
              </select>
              <span className="form-help">
                Conflitos por ID ou título + conteúdo. As notas existentes nunca
                são sobrescritas.
              </span>
            </label>
          )}
          {error && (
            <p role="alert" className="data-error">
              {error}
            </p>
          )}
          <div className="button-row">
            <button className="button" disabled={busy} onClick={close}>
              Cancelar
            </button>
            <button
              className="button button-primary"
              disabled={
                busy ||
                reading ||
                !notes.length ||
                (policy === 'ask' && plan.duplicates.length > 0)
              }
              onClick={() => void importNotes()}
            >
              {busy
                ? 'Importando…'
                : `Importar ${planned} ${planned === 1 ? 'nota' : 'notas'}`}
            </button>
          </div>
        </>
      )}
    </EntrySheet>
  )
}
