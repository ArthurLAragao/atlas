import { lazy, Suspense, useId, useRef, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
const ConfirmDialog = lazy(() =>
  import('./ConfirmDialog').then((m) => ({ default: m.ConfirmDialog })),
)

export function CompactCapture({
  label,
  placeholder,
  expandedPlaceholder,
  value,
  onChange,
  onCreate,
  busy,
  children,
  hint,
}: {
  label: string
  placeholder: string
  expandedPlaceholder?: string
  value: string
  onChange: (value: string) => void
  onCreate: () => Promise<boolean>
  busy: boolean
  children?: ReactNode
  hint?: string
}) {
  const [expanded, setExpanded] = useState(false),
    [discard, setDiscard] = useState(false)
  const input = useRef<HTMLInputElement>(null),
    content = useId(),
    help = useId()
  const suppress = useRef(false)
  function focusCollapsed() {
    suppress.current = true
    input.current?.focus()
    queueMicrotask(() => {
      suppress.current = false
    })
  }
  function close() {
    if (value.trim()) setDiscard(true)
    else {
      setExpanded(false)
      focusCollapsed()
    }
  }
  return (
    <form
      className="compact-capture"
      data-expanded={expanded}
      aria-busy={busy}
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim())
          void onCreate().then((ok) => {
            if (ok) {
              setExpanded(false)
              focusCollapsed()
            }
          })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
        if (e.key === 'Enter' && e.shiftKey) e.preventDefault()
      }}
    >
      <div className="compact-capture-line">
        <button
          type="button"
          className="icon-button"
          aria-label={
            expanded ? 'Recolher captura rápida' : 'Expandir captura rápida'
          }
          aria-expanded={expanded}
          aria-controls={content}
          disabled={busy}
          onClick={() => {
            if (expanded) close()
            else {
              setExpanded(true)
              input.current?.focus()
            }
          }}
        >
          <Plus aria-hidden="true" />
        </button>
        <input
          ref={input}
          aria-label={label}
          aria-controls={content}
          aria-describedby={hint ? help : undefined}
          placeholder={
            expanded ? (expandedPlaceholder ?? placeholder) : placeholder
          }
          maxLength={1000}
          value={value}
          disabled={busy}
          onFocus={() => {
            if (!suppress.current) setExpanded(true)
          }}
          onChange={(e) => {
            setExpanded(true)
            onChange(e.target.value)
          }}
        />
        {value && (
          <button
            className="icon-button"
            type="button"
            aria-label={`Limpar ${label.toLocaleLowerCase('pt-BR')}`}
            disabled={busy}
            onClick={() => {
              onChange('')
              input.current?.focus()
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
        <button className="button" disabled={busy || !value.trim()}>
          <Plus aria-hidden="true" />
          <span>
            Adicionar {label === 'Captura rápida' ? 'tarefa' : 'nota'}
          </span>
        </button>
      </div>
      {hint && (
        <p className="form-help" id={help}>
          {hint}
        </p>
      )}
      <div
        id={content}
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
        className="capture-expansion"
      >
        <div className="compact-capture-detail">
          {children}
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={close}
          >
            Recolher captura
          </button>
        </div>
      </div>
      <Suspense fallback={null}>
        {discard && (
          <ConfirmDialog
            title="Descartar esta captura?"
            name={value}
            description="O texto ainda não foi salvo. Você pode cancelar e continuar escrevendo."
            action="Descartar"
            onCancel={() => setDiscard(false)}
            onConfirm={() => {
              onChange('')
              setExpanded(false)
            }}
            restoreFocus={focusCollapsed}
          />
        )}
      </Suspense>
    </form>
  )
}
