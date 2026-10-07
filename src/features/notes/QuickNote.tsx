import { SelectMenu } from '../../components/SelectMenu'
import { useState } from 'react'
import type { Note } from '../../data/models'
import { CompactCapture } from '../../components/CompactCapture'
import { useData } from '../../app/data-store'
import { useNotes } from './note-store'
import { noteTemplates } from './templates'
import '../../styles/capture.css'
export function QuickNote({ onCreated }: { onCreated: (note: Note) => void }) {
  const [title, setTitle] = useState(''),
    [template, setTemplate] = useState('blank')
  const busy = useData((s) => s.busy),
    error = useNotes((s) => s.error)
  async function create() {
    const now = new Date().toISOString()
    const saved = await useNotes.getState().save(
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        content: noteTemplates.find((t) => t.id === template)!.content,
        tags: [],
        links: [],
        createdAt: now,
        updatedAt: now,
        isExample: false,
      },
      null,
    )
    if (!saved) return false
    setTitle('')
    onCreated(saved)
    return true
  }
  return (
    <CompactCapture
      label="Título da nova nota"
      placeholder="Registrar uma nota…"
      expandedPlaceholder="Nova nota… ou use nota: no atalho global"
      value={title}
      onChange={setTitle}
      onCreate={create}
      busy={busy}
    >
      <label className="task-field">
        Modelo da captura
        <SelectMenu
          label="Modelo da captura"
          value={template}
          disabled={busy}
          onChange={setTemplate}
          options={noteTemplates.map((t) => ({ value: t.id, label: t.title }))}
        />
      </label>
      {error && (
        <p role="alert" className="data-error">
          {error}
        </p>
      )}
    </CompactCapture>
  )
}
