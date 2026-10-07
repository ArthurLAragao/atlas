import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { noteTemplates } from './templates'
import { useNotes } from './note-store'
import type { Note } from '../../data/models'

export function NewNoteForm({
  initialTitle,
  onClose,
  onCreated,
}: {
  initialTitle: string
  onClose: () => void
  onCreated: (note: Note) => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [template, setTemplate] = useState('blank')
  const error = useNotes((state) => state.error)
  const busy = useData((state) => state.busy)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const now = new Date().toISOString()
    const saved = await useNotes.getState().save(
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        content: noteTemplates.find((item) => item.id === template)!.content,
        tags: [],
        links: [],
        createdAt: now,
        updatedAt: now,
        isExample: false,
      },
      null,
    )
    if (saved) onCreated(saved)
  }
  return (
    <EntrySheet
      title="Nova nota"
      description="Comece em branco ou use um modelo. O texto continua sendo seu."
      onClose={onClose}
    >
      <form className="note-form" onSubmit={(event) => void submit(event)}>
        <label>
          Título da nota
          <input
            autoFocus
            required
            maxLength={240}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Modelo
          <select
            value={template}
            disabled={busy}
            onChange={(event) => setTemplate(event.target.value)}
          >
            {noteTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="data-error">
            {error}
          </p>
        )}
        <div className="note-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            disabled={busy || !title.trim()}
          >
            Criar nota
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
