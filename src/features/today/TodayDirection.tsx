import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Goal, Task } from '../../data/models'
import { formatDay } from '../../lib/habits'
import type { goalTaskProgress } from '../../lib/today'
import { directionHref, goalDeadline, goalProgress } from '../../lib/goals'

export function TodayDirection({
  only,
  appointment,
  goal,
  progress,
  today,
  busy,
  onAppointment,
  onGoal,
  onComplete,
}: {
  only?: 'appointment' | 'goal'
  appointment?: Task
  goal?: Goal
  progress?: ReturnType<typeof goalTaskProgress>
  today: string
  busy: boolean
  onAppointment: () => void
  onGoal: () => void
  onComplete: (task: Task) => void
}) {
  return (
    <div className={only ? undefined : 'today-direction'}>
      {only !== 'goal' && (
        <section className="today-section" aria-labelledby="today-appointment">
          <div className="section-heading">
            <h2 id="today-appointment">Próximo compromisso</h2>
            <button
              data-appointment-trigger
              className="button"
              disabled={busy}
              onClick={onAppointment}
            >
              {appointment ? 'Editar compromisso' : 'Adicionar compromisso'}
            </button>
          </div>
          {appointment ? (
            <div className="today-appointment">
              <p className="eyebrow">
                {appointment.dueDate === today
                  ? 'Hoje'
                  : formatDay(appointment.dueDate!)}{' '}
                · {appointment.dueTime}
              </p>
              <h3>{appointment.title}</h3>
              {appointment.isExample && (
                <span className="form-help">Exemplo</span>
              )}
              <button
                className="button"
                disabled={busy}
                onClick={() => onComplete(appointment)}
              >
                Concluir compromisso
              </button>
            </div>
          ) : (
            <p className="today-empty">
              Nenhum próximo horário anotado. Adicione seu compromisso
              manualmente.
            </p>
          )}
          <Link className="today-link" to="/tarefas">
            Ver agenda em Tarefas <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
      )}
      {only !== 'appointment' && (
        <section className="today-section" aria-labelledby="today-goal">
          <div className="section-heading">
            <h2 id="today-goal">Meta da semana</h2>
            <button className="button" disabled={busy} onClick={onGoal}>
              {goal ? 'Editar meta' : 'Definir meta'}
            </button>
          </div>
          {goal && progress ? (
            <div className="today-goal">
              <h3>
                <Link to={directionHref('goals', goal.id)}>{goal.title}</Link>
              </h3>
              {goal.isExample && <span className="form-help">Exemplo</span>}
              <p className="form-help">{goalDeadline(goal, today).label}</p>
              {goal.keyResults.length > 0 && (
                <>
                  <label className="form-help" htmlFor="weekly-results">
                    Resultados-chave: {goalProgress(goal).completed} de{' '}
                    {goalProgress(goal).total} atingidos ·{' '}
                    {goalProgress(goal).percent}%
                  </label>
                  <progress
                    id="weekly-results"
                    max={100}
                    value={goalProgress(goal).percent}
                  />
                </>
              )}
              <label className="form-help" htmlFor="weekly-progress">
                {progress.total
                  ? `${progress.completed} de ${progress.total} tarefas vinculadas concluídas`
                  : 'Edite a meta e vincule tarefas para acompanhar o progresso.'}
              </label>
              <progress
                id="weekly-progress"
                max={100}
                value={progress.percent}
              />
              <span className="form-help">{progress.percent}%</span>
            </div>
          ) : (
            <p className="today-empty">
              Uma direção é suficiente. Defina o que quer avançar nesta semana.
            </p>
          )}
          <Link className="today-link" to="/metas">
            Ver metas e projetos <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  )
}
