import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { relatedRecords, directionHref } from '../../lib/goals'
import { useDirections } from './direction-store'
import type { RelationType } from './RelationForm'
import { relationNames } from './relation-names'

const headings: Record<RelationType, string> = {
  tasks: 'Tarefas vinculadas',
  notes: 'Notas vinculadas',
  goals: 'Metas vinculadas',
  projects: 'Projetos vinculados',
}
export function Relations({
  type,
  id,
  targetType,
  editable,
  onLink,
}: {
  type: 'goals' | 'projects'
  id: string
  targetType: RelationType
  editable: boolean
  onLink: () => void
}) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const headingId = useId()
  const add = useRef<HTMLButtonElement>(null)
  const [page, setPage] = useState(0)
  const related = relatedRecords(data, type, id, targetType)
  const last = Math.max(0, Math.ceil(related.length / 20) - 1)
  const current = Math.min(page, last)
  const title = headings[targetType]
  return (
    <section className="direction-section" aria-labelledby={headingId}>
      <div className="section-heading">
        <h2 id={headingId}>{title}</h2>
        {editable && (
          <button ref={add} className="button" disabled={busy} onClick={onLink}>
            Vincular {relationNames[targetType]}
          </button>
        )}
      </div>
      {related.length ? (
        <ul className="direction-related" aria-label={title}>
          {related.slice(current * 20, (current + 1) * 20).map((item) => (
            <li key={item.id}>
              <Link to={directionHref(targetType, item.id)}>{item.title}</Link>
              {'status' in item && item.status === 'done' && (
                <span className="form-help">Concluída</span>
              )}
              {editable && (
                <button
                  className="button"
                  disabled={busy}
                  aria-label={`Desvincular ${item.title}`}
                  onClick={async () => {
                    if (
                      await useDirections
                        .getState()
                        .link(type, id, targetType, item.id, false)
                    )
                      requestAnimationFrame(() => add.current?.focus())
                  }}
                >
                  Desvincular
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="form-help">
          {editable
            ? 'Ainda não há registros vinculados. Escolha um registro existente para conectar.'
            : 'Nenhum registro vinculado.'}
        </p>
      )}
      {last > 0 && (
        <div className="direction-actions">
          <button
            className="button"
            aria-label={`Página anterior de ${title}`}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Anterior
          </button>
          <span className="form-help" role="status">
            Página {current + 1} de {last + 1}
          </span>
          <button
            className="button"
            aria-label={`Próxima página de ${title}`}
            disabled={current === last}
            onClick={() => setPage(current + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  )
}
