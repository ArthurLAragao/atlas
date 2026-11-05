import { useEffect, useState } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { captureReference, decodeCapture, type CaptureItem } from '../../lib/lumen-capture'
import { useData } from '../../app/data-store'
import { useNotes } from './note-store'
import { TaskForm } from '../tasks/TaskForm'
import '../../styles/lumen-transfer.css'

const endpoint = 'http://127.0.0.1:43127'
export function LumenCaptureButton() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener('atlas:open-capture', show)
    return () => window.removeEventListener('atlas:open-capture', show)
  }, [])
  return <>
    <button className="button" onClick={() => setOpen(true)}>Capturar vídeo</button>
    {open && <CaptureDesk onClose={() => setOpen(false)} />}
  </>
}

function CaptureDesk({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [token, setToken] = useState('')
  const [rows, setRows] = useState<CaptureItem[]>([])
  const [taskDraft, setTaskDraft] = useState<{ title: string; noteId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Abra o Lumen e escolha Capturar vídeo para ativar a conexão local.')
  async function connect() {
    setBusy(true)
    try {
      const response = await fetch(endpoint + '/health', { signal: AbortSignal.timeout(4000) })
      const data: unknown = await response.json()
      if (!response.ok || !data || typeof data !== 'object' || !('service' in data) ||
        data.service !== 'lumen-capture-v1' || !('token' in data) || typeof data.token !== 'string') throw new Error()
      setToken(data.token)
      setMessage('Lumen conectado. A transcrição será enviada ao Codex usando seu acesso ChatGPT.')
    } catch { setMessage('Lumen indisponível. Abra a janela Capturar vídeo no Lumen e tente conectar novamente.') }
    finally { setBusy(false) }
  }
  useEffect(() => {
    if (!token) return
    let active = true
    const controller = new AbortController()
    async function refresh() {
      try {
        const response = await fetch(endpoint + '/captures', {
          headers: { 'X-Lumen-Token': token }, signal: controller.signal,
        })
        const data: unknown = await response.json()
        if (!response.ok) throw new Error()
        if (active && data && typeof data === 'object' && 'captures' in data && Array.isArray(data.captures)) {
          setRows(data.captures.map(decodeCapture).filter((item): item is CaptureItem => item !== null))
        }
      } catch { if (active) setMessage('Conexão interrompida. Confira o Lumen antes de reenviar.') }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { active = false; controller.abort(); window.clearInterval(timer) }
  }, [token])
  async function prepareTask(row: CaptureItem) {
    if (busy || useData.getState().busy) return
    setBusy(true)
    try {
      const reference = captureReference(row)
      const existing = useData.getState().data.notes.find((note) => note.id === reference.id)
      if (!existing) {
        const now = new Date().toISOString()
        const saved = await useNotes.getState().save({ ...reference, links: [], isExample: false,
          createdAt: now, updatedAt: now }, null)
        if (!saved) { setMessage('Não foi possível salvar a referência. Nenhuma tarefa foi preparada.'); return }
      }
      setTaskDraft({ title: ('Praticar: ' + row.title).slice(0, 240), noteId: reference.id })
    } finally { setBusy(false) }
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(endpoint + '/captures', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lumen-Token': token },
        body: JSON.stringify({ url, title }), signal: AbortSignal.timeout(6000),
      })
      const data: unknown = await response.json()
      if (!response.ok) {
        const detail = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Não foi possível enviar.'
        setMessage(detail); return
      }
      setMessage('Captura recebida pelo Lumen. Acompanhe a fila; revisão e publicação ficam no Lumen.')
    } catch { setMessage('Envio não confirmado. Confira a fila no Lumen antes de tentar novamente.') }
    finally { setBusy(false) }
  }
  if (taskDraft) return <TaskForm initialTitle={taskDraft.title}
    initialLinks={[{ type: 'notes', id: taskDraft.noteId }]}
    onClose={() => { setTaskDraft(null); setMessage('Referência preservada no Atlas. Confira a lista de tarefas para ver as atividades salvas.') }} />
  return <EntrySheet title="Capturar vídeo no Lumen" description="Prepare uma nota a partir de uma URL do YouTube." onClose={onClose} dismissDisabled={busy}>
    <div className="lumen-transfer-flow">
      <p role="status">{message}</p>
      <button className="button" disabled={busy} onClick={() => void connect()}>Conectar ao Lumen</button>
      <form onSubmit={(event) => void submit(event)} className="lumen-transfer-flow">
        <label className="field">URL do YouTube<input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label className="field">Título opcional<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <button className="button" disabled={!token || busy} type="submit">Capturar e resumir</button>
      </form>
      <p className="form-help">Não conclui tarefas nem registra estudo. Formato válido não significa conteúdo factualmente verificado.</p>
      <ul className="lumen-history-list" aria-label="Fila de capturas">
        {rows.map((row) => <li key={row.id}>
          <strong>{row.title}</strong><span>{row.message}</span>
          {row.notionUrl && <a href={row.notionUrl} target="_blank" rel="noreferrer">Abrir nota no Notion</a>}
          {row.state === 'ready' && row.exercise && <>
            <details><summary>Prática sugerida pela IA</summary><p>{row.exercise}</p></details>
            <button className="button" disabled={busy} onClick={() => void prepareTask(row)}>Salvar referência e preparar tarefa</button>
            <p className="form-help">Salva uma referência local e abre uma tarefa para revisão. Cancelar a tarefa mantém a referência.</p>
          </>}
        </li>)}
      </ul>
    </div>
  </EntrySheet>
}
