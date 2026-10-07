import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { createCapturedEntity, parseCapture } from '../../lib/capture'
import { useDirections } from './direction-store'
import { useActiveForm } from './use-active-form'

export function ProjectCaptureForm({
  projectId,
  kind,
  onClose,
  onCreated,
}: {
  projectId: string
  kind: 'task' | 'note'
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const busy = useData((state) => state.busy)
  const name = kind === 'task' ? 'tarefa' : 'nota'
  const active = useActiveForm()
  async function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const now = new Date()
      const entry = createCapturedEntity(
        parseCapture(`${name}: ${title}`, now),
        now,
        crypto.randomUUID(),
      )
      if (entry.collection === 'tasks' || entry.collection === 'notes') {
        const saved = await useDirections
          .getState()
          .createItem(projectId, entry.collection, entry.item)
        if (!active.current) return
        if (saved) onCreated(saved.id)
        else
          setError(
            useDirections.getState().error ??
              'Não foi possível criar. Tente novamente.',
          )
      }
    } catch {
      setError('Use um título de até 240 caracteres. Em notas, evite [[ e ]].')
    }
  }
  return (
    <EntrySheet
      title={`Nova ${name} no projeto`}
      description={`A ${name} será vinculada a este projeto ao criar.`}
      onClose={onClose}
    >
      <form className="direction-form" onSubmit={(event) => void submit(event)}>
        <label>
          Título da {name}
          <input
            autoFocus
            required
            maxLength={4000}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <p className="form-help">
          {kind === 'task'
            ? 'Pode usar amanhã 19h, #tag e !alta, como na captura rápida.'
            : 'Comece pelo título. A edição abre em seguida.'}
        </p>
        {error && (
          <p role="alert" className="data-error">
            {error}
          </p>
        )}
        <div className="direction-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            disabled={busy || !title.trim()}
          >
            Criar {name}
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
