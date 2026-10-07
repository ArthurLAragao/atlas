import { useId, useRef, useState } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { useCommands } from '../app/command-store'

/** The contextual entry only forwards to the existing global command palette. */
export function SeekCapture() {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)

  function close() {
    setExpanded(false)
    // Keep the local draft; closing is reversible and never discards typing.
    requestAnimationFrame(() => trigger.current?.focus())
  }
  function open() {
    setExpanded(true)
    requestAnimationFrame(() => input.current?.focus())
  }
  function submit() {
    useCommands.getState().openPalette(query)
  }
  return (
    <div className="seek-capture" data-expanded={expanded}>
      <button
        ref={trigger}
        data-command-trigger
        className="icon-button seek-trigger"
        aria-label="Capturar ou navegar"
        aria-expanded={expanded}
        aria-controls={expanded ? id : undefined}
        aria-keyshortcuts="Control+k Meta+k"
        title="Capturar ou navegar (Ctrl/Cmd+K)"
        onClick={open}
        hidden={expanded}
      >
        <Search aria-hidden="true" />
      </button>
      {expanded && (
        <form
          id={id}
          className="seek-input-group"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              close()
            }
          }}
        >
          <Search aria-hidden="true" />
          <input
            ref={input}
            aria-label="Captura global"
            placeholder="Anotar ou encontrar…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="icon-button"
            type="submit"
            aria-label="Abrir captura e busca"
          >
            <ArrowUpRight aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Recolher captura"
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  )
}
