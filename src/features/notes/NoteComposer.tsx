import { useId, useRef, useState } from 'react'
import type { Note } from '../../data/models'
import { linkCompletion, noteKey } from '../../lib/note-links'

export function NoteComposer({
  content,
  onChange,
  notes,
  disabled = false,
}: {
  content: string
  onChange: (value: string) => void
  notes: Note[]
  disabled?: boolean
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const [caret, setCaret] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState(0)
  const completion = !dismissed ? linkCompletion(content, caret) : null
  const candidates = completion
    ? notes
        .filter(
          (note) =>
            !note.archivedAt &&
            !/\[\[|\]\]/u.test(note.title) &&
            noteKey(note.title).includes(noteKey(completion.query)),
        )
        .slice(0, 8)
    : []
  function choose(note: Note) {
    if (!completion) return
    const text = `[[${note.title}]]`
    onChange(
      content.slice(0, completion.start) + text + content.slice(completion.end),
    )
    const next = completion.start + text.length
    setCaret(next)
    setDismissed(true)
    requestAnimationFrame(() => {
      textarea.current?.focus()
      textarea.current?.setSelectionRange(next, next)
    })
  }
  return (
    <div className="note-composer">
      <label htmlFor={`${id}-text`}>Conteúdo Markdown</label>
      <p id={`${id}-hint`} className="form-help">
        Use # para títulos, **texto** para destaque e [[ para conectar notas.
        Ctrl/Cmd+S salva.
      </p>
      <textarea
        ref={textarea}
        id={`${id}-text`}
        className="note-textarea"
        value={content}
        maxLength={500_000}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        aria-controls={candidates.length ? `${id}-suggestions` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          candidates.length
            ? `${id}-option-${Math.min(selected, candidates.length - 1)}`
            : undefined
        }
        onChange={(event) => {
          onChange(event.target.value)
          setCaret(event.target.selectionStart)
          setDismissed(false)
          setSelected(0)
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || !candidates.length) return
          if (event.key === 'Escape') {
            event.preventDefault()
            setDismissed(true)
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setSelected(
              (value) =>
                (value +
                  (event.key === 'ArrowDown' ? 1 : -1) +
                  candidates.length) %
                candidates.length,
            )
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            choose(candidates[Math.min(selected, candidates.length - 1)]!)
          }
        }}
      />
      {candidates.length > 0 && (
        <div className="note-suggestions">
          <p className="form-help" role="status">
            {candidates.length} sugestões. Setas escolhem, Enter insere, Esc
            fecha.
          </p>
          <div
            role="listbox"
            id={`${id}-suggestions`}
            aria-label="Sugestões de links"
          >
            {candidates.map((note, index) => (
              <button
                key={note.id}
                type="button"
                className="note-suggestion button"
                role="option"
                id={`${id}-option-${index}`}
                aria-selected={
                  index === Math.min(selected, candidates.length - 1)
                }
                onClick={() => choose(note)}
              >
                {note.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
