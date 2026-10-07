import { Link } from 'react-router-dom'
import { useData } from '../app/data-store'

export function FocusTotal({
  type,
  id,
}: {
  type: 'tasks' | 'projects' | 'subjects' | 'studyPaths'
  id: string
}) {
  const milliseconds = useData((state) =>
    state.data.focusSessions.reduce(
      (sum, session) =>
        sum +
        (session.mode === 'focus' &&
        session.status !== 'in-progress' &&
        (type === 'tasks'
          ? session.taskId === id
          : session.links.some((link) => link.type === type && link.id === id))
          ? session.elapsedMs
          : 0),
      0,
    ),
  )
  return milliseconds > 0 ? (
    <p className="direction-help">
      <span className="direction-number">
        {(milliseconds / 60000).toLocaleString('pt-BR', {
          maximumFractionDigits: 2,
        })}{' '}
        min
      </span>{' '}
      de foco registrados neste contexto.{' '}
      <Link className="direction-external" to="/foco">
        Ver sessões
      </Link>
    </p>
  ) : null
}
