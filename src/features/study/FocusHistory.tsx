import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { FocusSession } from '../../data/models'
import { useData } from '../../app/data-store'
import { focusModeLabels } from '../../lib/focus'
import { repository } from '../../data/service'
import { learningChange } from './learning-store'

export function FocusHistory({ sessions }: { sessions: FocusSession[] }) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  function unlink(session: FocusSession) {
    const heading = document.querySelector<HTMLElement>(
      '[data-focus-history-heading]',
    )
    void learningChange(
      () => repository.unlinkFocusTask(session.id, session.updatedAt),
      'Tarefa desvinculada. O registro e os contextos foram preservados; você pode desfazer.',
    ).then((ok) => {
      if (ok)
        requestAnimationFrame(() => {
          if (heading?.isConnected) heading.focus()
        })
    })
  }
  const [page, setPage] = useState(0)
  const records = [...sessions]
    .filter((item) => item.status !== 'in-progress')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(records.length / 20) - 1),
  )
  return (
    <section className="direction-section">
      <h2 data-focus-history-heading tabIndex={-1}>
        Sessões registradas
      </h2>
      <p className="direction-help">
        Tempo real ativo, sem as pausas do cronômetro. Pausas curtas e longas
        têm seus próprios registros.
      </p>
      {!records.length && (
        <p>Ao encerrar uma sessão, seu tempo aparecerá aqui.</p>
      )}
      <ul className="direction-key-results">
        {records.slice(current * 20, (current + 1) * 20).map((session) => (
          <li key={session.id}>
            <strong>{session.title}</strong>
            <span>
              {focusModeLabels[session.mode]} ·{' '}
              {session.status === 'completed' ? 'Concluída' : 'Interrompida'} ·{' '}
              <span className="direction-number">
                {(session.elapsedMs / 60000).toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}{' '}
                min
              </span>{' '}
              · {new Date(session.startedAt).toLocaleString('pt-BR')}
            </span>
            <div className="direction-actions">
              {session.taskId && (
                <Link
                  className="direction-external"
                  to={`/tarefas?task=${encodeURIComponent(session.taskId)}`}
                >
                  Abrir tarefa
                </Link>
              )}
              {session.links.map((link) => {
                const item = data[link.type].find(
                  (record) => record.id === link.id,
                )
                return item &&
                  ['projects', 'subjects', 'studyPaths'].includes(link.type) ? (
                  <Link
                    key={`${link.type}-${link.id}`}
                    className="direction-external"
                    to={
                      link.type === 'projects'
                        ? `/metas?project=${encodeURIComponent(link.id)}`
                        : `/estudos?${link.type === 'subjects' ? 'subject' : 'path'}=${encodeURIComponent(link.id)}`
                    }
                  >
                    {item.title}
                  </Link>
                ) : null
              })}
            </div>
            {session.taskId && (
              <details>
                <summary>Manter ou remover o vínculo da tarefa</summary>
                <p className="direction-help">
                  O tempo permanece nesta sessão. Desvincular retira esses
                  minutos do total da tarefa e permite excluí-la depois de
                  remover os outros vínculos.
                </p>
                <button
                  className="button"
                  disabled={busy}
                  aria-label={`Desvincular tarefa da sessão ${session.title}`}
                  onClick={() => unlink(session)}
                >
                  Desvincular tarefa
                </button>
              </details>
            )}
          </li>
        ))}
      </ul>
      {records.length > 20 && (
        <nav className="direction-actions" aria-label="Páginas de sessões">
          <button
            className="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Mais recentes
          </button>
          <span>
            Página {current + 1} de {Math.ceil(records.length / 20)}
          </span>
          <button
            className="button"
            disabled={(current + 1) * 20 >= records.length}
            onClick={() => setPage(current + 1)}
          >
            Mais antigas
          </button>
        </nav>
      )}
    </section>
  )
}
