import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { relatedRecords } from '../../lib/goals'
import { searchKey } from '../../lib/search'
import { useDirections } from './direction-store'
import { useActiveForm } from './use-active-form'

export type RelationType = 'tasks' | 'notes' | 'goals' | 'projects'
import { relationNames } from './relation-names'
export function RelationForm({
  type,
  id,
  targetType,
  onClose,
}: {
  type: 'goals' | 'projects'
  id: string
  targetType: RelationType
  onClose: () => void
}) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const error = useDirections((state) => state.error)
  const active = useActiveForm()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const linked = new Set(
    relatedRecords(data, type, id, targetType).map((item) => item.id),
  )
  const available = data[targetType]
    .filter(
      (item) =>
        item.id !== id &&
        !linked.has(item.id) &&
        searchKey(`${item.title} ${item.tags.join(' ')}`).includes(
          searchKey(query),
        ),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  const name = relationNames[targetType]
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      (await useDirections
        .getState()
        .link(type, id, targetType, selected, true)) &&
      active.current
    )
      onClose()
  }
  return (
    <EntrySheet
      title={`Vincular ${name}`}
      description="Escolha um registro existente. Ele continua no seu módulo original."
      onClose={onClose}
    >
      <form className="direction-form" onSubmit={(event) => void submit(event)}>
        <label>
          Filtrar registros
          <input
            type="search"
            autoFocus
            value={query}
            disabled={busy}
            placeholder="Título ou tag"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected('')
            }}
          />
        </label>
        <label>
          Escolher {name}
          <select
            value={selected}
            disabled={busy}
            required
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Selecione um registro</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {!available.length && (
          <p role="status" className="form-help">
            Nenhum registro disponível. Crie um no módulo correspondente ou
            tente outra busca.
          </p>
        )}
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
            disabled={busy || !selected}
          >
            Vincular
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
