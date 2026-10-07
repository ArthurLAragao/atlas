import { Plus, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { Task } from '../../data/models'

export function SubtaskEditor({
  items,
  onChange,
  busy,
}: {
  items: Task['subtasks']
  onChange: (items: Task['subtasks']) => void
  busy: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  function add() {
    if (!draft.trim() || items.length >= 200) return
    onChange([
      ...items,
      { id: crypto.randomUUID(), title: draft.trim(), done: false },
    ])
    setDraft('')
    input.current?.focus()
  }
  return (
    <fieldset className="subtask-editor">
      <legend>
        Subtarefas · {items.filter((item) => item.done).length}/{items.length}
      </legend>
      <ul>
        {items.map((item, index) => (
          <li key={item.id}>
            <input
              className="task-checkbox"
              type="checkbox"
              checked={item.done}
              disabled={busy}
              aria-label={`Concluir subtarefa ${index + 1}`}
              onChange={(event) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, done: event.target.checked }
                      : entry,
                  ),
                )
              }
            />
            <input
              id={`${id}-${index}`}
              className="task-input"
              aria-label={`Subtarefa ${index + 1}`}
              value={item.title}
              required
              maxLength={240}
              disabled={busy}
              onChange={(event) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, title: event.target.value }
                      : entry,
                  ),
                )
              }
            />
            <button
              className="icon-button"
              type="button"
              disabled={busy}
              aria-label={`Remover subtarefa ${index + 1}`}
              onClick={() => {
                onChange(items.filter((entry) => entry.id !== item.id))
                requestAnimationFrame(() => {
                  ;(
                    document.getElementById(
                      `${id}-${Math.max(0, index - 1)}`,
                    ) ?? input.current
                  )?.focus()
                })
              }}
            >
              <X aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="subtask-add">
        <label className="task-field">
          Nova subtarefa
          <input
            ref={input}
            value={draft}
            maxLength={240}
            disabled={busy || items.length >= 200}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
          />
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Adicionar subtarefa"
          disabled={busy || !draft.trim() || items.length >= 200}
          onClick={add}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
      <p className="task-help">
        Enter adiciona. As alterações são guardadas ao salvar a tarefa.
      </p>
    </fieldset>
  )
}
