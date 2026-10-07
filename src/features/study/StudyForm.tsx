import { DateField } from '../../components/DateField'
import { useState, type ReactNode } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { useActiveForm } from '../goals/use-active-form'
import { useStudy } from './study-store'

export function StudyForm({
  title,
  children,
  onClose,
  onSubmit,
  submit = 'Salvar',
}: {
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit: (data: FormData) => Promise<boolean>
  submit?: string
}) {
  const busy = useData((state) => state.busy)
  const error = useStudy((state) => state.error)
  const [invalid, setInvalid] = useState('')
  const active = useActiveForm()
  return (
    <EntrySheet
      title={title}
      description="Comece pelo essencial. Você pode ajustar os detalhes depois."
      onClose={onClose}
    >
      <form
        className="direction-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          setInvalid('')
          const values = new FormData(event.currentTarget)
          void onSubmit(values)
            .then((ok) => {
              if (ok && active.current) onClose()
            })
            .catch((failure: unknown) => {
              if (active.current)
                setInvalid(
                  failure instanceof Error
                    ? failure.message
                    : 'Revise os campos e tente salvar novamente.',
                )
            })
        }}
      >
        <fieldset disabled={busy} className="direction-form">
          {children}
        </fieldset>
        {(invalid || error) && (
          <p role="alert" className="data-error">
            {invalid || error} Seu texto continua no formulário.
          </p>
        )}
        <div className="direction-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {submit}
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
export function Field({
  label,
  name,
  value = '',
  type = 'text',
  required = false,
  min,
  max,
  step,
}: {
  label: string
  name: string
  value?: string | number | null
  type?: string
  required?: boolean
  min?: number
  max?: number
  step?: number | string
}) {
  return (
    <label>
      {label}
      {type === 'date' ? (
        <DateField
          label={label}
          name={name}
          defaultValue={value ?? ''}
          required={required}
          min={min}
          max={max}
        />
      ) : (
        <input
          autoFocus={name === 'title'}
          name={name}
          type={type}
          defaultValue={value ?? ''}
          required={required}
          min={min}
          max={max}
          step={step}
          maxLength={type === 'text' ? 240 : undefined}
        />
      )}
    </label>
  )
}
// Helpers live with these small forms; exports are not component entry points.
// eslint-disable-next-line react-refresh/only-export-components
export function text(data: FormData, key: string) {
  return String(data.get(key) ?? '').trim()
}
// eslint-disable-next-line react-refresh/only-export-components
export function optional(data: FormData, key: string) {
  return text(data, key) || null
}
// eslint-disable-next-line react-refresh/only-export-components
export function number(data: FormData, key: string) {
  return text(data, key) ? Number(text(data, key).replace(',', '.')) : null
}
// eslint-disable-next-line react-refresh/only-export-components
export function tags(data: FormData) {
  return [
    ...new Set(
      text(data, 'tags')
        .split(/[,#]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
}
// eslint-disable-next-line react-refresh/only-export-components
export function base(id = crypto.randomUUID()) {
  const timestamp = new Date().toISOString()
  return {
    id,
    tags: [],
    links: [],
    isExample: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
