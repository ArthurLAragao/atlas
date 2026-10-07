import { useData } from '../app/data-store'
import { type Collection } from '../data/models'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const labels: Record<Collection, string> = {
  tasks: 'Tarefas salvas',
  habits: 'Hábitos salvos',
  habitLogs: 'Registros de hábitos',
  notes: 'Notas salvas',
  goals: 'Metas salvas',
  projects: 'Projetos salvos',
  subjects: 'Disciplinas salvas',
  studyPaths: 'Trilhas salvas',
  flashcards: 'Flashcards salvos',
  focusSessions: 'Sessões de foco',
}
export function LocalRecords({ collection }: { collection: Collection }) {
  const { hash } = useLocation()
  const items = useData((state) => state.data[collection])
  const status = useData((state) => state.status)
  const target = items.find((item) => `#record-${item.id}` === hash)
  const targetId = target?.id
  const visible = target
    ? [target, ...items.filter((item) => item.id !== target.id).slice(0, 4)]
    : items.slice(0, 5)
  useEffect(() => {
    if (targetId) {
      const frame = requestAnimationFrame(() =>
        document.getElementById(`record-${targetId}`)?.focus(),
      )
      return () => cancelAnimationFrame(frame)
    }
  }, [targetId])
  if (status !== 'ready') return null
  return (
    <section className="local-records" aria-label={labels[collection]}>
      <div className="section-heading">
        <h2>{labels[collection]}</h2>
        <span className="caption">{items.length} no navegador</span>
      </div>
      {items.length ? (
        <>
          <ul className="record-list">
            {visible.map((item) => (
              <li key={item.id} id={`record-${item.id}`} tabIndex={-1}>
                <div>
                  <strong>
                    {'title' in item
                      ? item.title
                      : 'question' in item
                        ? item.question
                        : item.date}
                  </strong>
                  {'content' in item && (
                    <p className="record-excerpt">
                      {item.content.slice(0, 180)}
                    </p>
                  )}
                </div>
                <span className="caption">
                  {item.isExample ? 'Exemplo' : 'Seu registro'}
                </span>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <p className="caption">
              Prévia dos primeiros 5 registros. A exportação inclui todos.
            </p>
          )}
        </>
      ) : (
        <p>
          Seu espaço está vazio. Abra “Seus dados” para importar um backup ou
          uma nota Markdown.
        </p>
      )}
    </section>
  )
}
