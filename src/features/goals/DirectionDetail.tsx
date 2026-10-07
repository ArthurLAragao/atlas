import { ConfirmAction } from '../../components/ConfirmAction'
import { PinButton } from '../profile/PinButton'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import type { Goal, Project } from '../../data/models'
import { PageHeader } from '../../components/PageHeader'
import {
  goalProgress,
  keyResultProgress,
  goalDeadline,
  goalStatus,
  projectStatus,
  goalStatusLabels,
  projectStatusLabels,
} from '../../lib/goals'
import { goalTaskProgress } from '../../lib/today'
import { dateKey } from '../../lib/habits'
import { useDirections } from './direction-store'
import { Relations } from './Relations'
import type { RelationType } from './RelationForm'
import { FocusTotal } from '../../components/FocusTotal'

export function DirectionDetail({
  item,
  type,
  onEdit,
  onLink,
  onCreate,
  onRemoved,
}: {
  item: Goal | Project
  type: 'goals' | 'projects'
  onEdit: () => void
  onLink: (target: RelationType) => void
  onCreate: (kind: 'task' | 'note') => void
  onRemoved: () => void
}) {
  const busy = useData((state) => state.busy)
  const tasks = useData((state) => state.data.tasks)
  const goal = 'keyResults' in item ? item : null
  const project = 'urls' in item ? item : null
  const status = goal ? goalStatus(goal) : projectStatus(project!)
  const archived = status === 'archived'
  const noun = goal ? 'meta' : 'projeto'
  const progress = goal ? goalProgress(goal) : null
  const taskProgress = goal ? goalTaskProgress(goal, tasks) : null
  async function archive() {
    if (await useDirections.getState().archive(type, item.id, !archived)) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>('[data-archive-direction]')
          ?.focus(),
      )
    }
  }
  return (
    <div className="direction-detail">
      <Link className="button" to="/metas">
        Voltar às metas e projetos
      </Link>
      <PageHeader
        title={item.title}
        eyebrow={goal ? 'Direção e resultados' : 'Construir com propósito'}
      >
        {goal
          ? goalStatusLabels[goalStatus(goal)]
          : projectStatusLabels[projectStatus(project!)]}
        {item.isExample ? ' · Exemplo' : ''}
        {goal?.weekly ? ' · Meta da semana' : ''}
      </PageHeader>
      {project && <FocusTotal type="projects" id={project.id} />}
      <div className="direction-actions">
        <PinButton type={type} id={item.id} />
        <button
          data-edit-direction
          className="button"
          disabled={busy || archived}
          onClick={onEdit}
        >
          Editar {noun}
        </button>
      </div>
      {goal && progress && (
        <section className="direction-section" aria-label="Progresso da meta">
          <h2>Resultados-chave</h2>
          <div className="direction-progress-value">
            <strong>{progress.percent}%</strong>
            <span>
              {progress.completed} de {progress.total} resultados atingidos
            </span>
          </div>
          <progress
            aria-label="Progresso dos resultados-chave"
            max={100}
            value={progress.percent}
          />
          <p className="form-help">
            {goalDeadline(goal, dateKey(new Date())).label}
          </p>
          {goal.keyResults.length ? (
            <ul className="direction-key-results">
              {goal.keyResults.map((result) => (
                <li key={result.id}>
                  <h3>{result.title}</h3>
                  <p>
                    <span className="direction-number">
                      {result.current.toLocaleString('pt-BR', {
                        maximumSignificantDigits: 21,
                      })}{' '}
                      /{' '}
                      {result.target.toLocaleString('pt-BR', {
                        maximumSignificantDigits: 21,
                      })}
                    </span>
                    {result.unit ? ` ${result.unit}` : ''} ·{' '}
                    {keyResultProgress(result)}%
                  </p>
                  <progress
                    aria-label={`Progresso de ${result.title}`}
                    max={100}
                    value={keyResultProgress(result)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-help">
              Edite a meta e adicione uma medida, como 3 de 10 módulos. As
              tarefas continuam separadas.
            </p>
          )}
          {taskProgress && (
            <div className="direction-task-progress">
              <h3>Ações que ajudam</h3>
              <p>
                {taskProgress.completed} de {taskProgress.total} tarefas
                concluídas · {taskProgress.percent}%
              </p>
              <progress
                aria-label="Progresso por tarefas vinculadas"
                max={100}
                value={taskProgress.percent}
              />
              <p className="form-help">
                Este progresso acompanha as tarefas e preserva suas medidas
                manuais.
              </p>
            </div>
          )}
        </section>
      )}
      {project && !archived && (
        <section
          className="direction-section"
          aria-label="Próximos passos do projeto"
        >
          <h2>Próximos passos</h2>
          <p className="form-help">
            Uma ação pequena ou uma anotação já faz o projeto avançar.
          </p>
          <div className="direction-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => onCreate('task')}
            >
              Criar tarefa neste projeto
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => onCreate('note')}
            >
              Criar nota neste projeto
            </button>
          </div>
        </section>
      )}
      <Relations
        type={type}
        id={item.id}
        targetType="tasks"
        editable={!archived}
        onLink={() => onLink('tasks')}
      />
      {project && (
        <Relations
          type={type}
          id={item.id}
          targetType="notes"
          editable={!archived}
          onLink={() => onLink('notes')}
        />
      )}
      <Relations
        type={type}
        id={item.id}
        targetType={goal ? 'projects' : 'goals'}
        editable={!archived}
        onLink={() => onLink(goal ? 'projects' : 'goals')}
      />
      <details className="direction-section">
        <summary>Descrição, tags e links</summary>
        <p className="direction-description">
          {item.description ||
            'Sem descrição. Edite para registrar o propósito.'}
        </p>
        <p className="form-help">
          {item.tags.length
            ? item.tags.map((tag) => `#${tag}`).join(' ')
            : 'Sem tags.'}
        </p>
        {goal?.deadline && (
          <p>Prazo: {goal.deadline.split('-').reverse().join('/')}</p>
        )}
        {project?.repositoryUrl && (
          <a
            className="direction-external"
            href={project.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir repositório
          </a>
        )}
        {project && (
          <ul className="direction-urls">
            {project.urls.map((url, index) => (
              <li key={`${index}-${url.url}`}>
                <a href={url.url} target="_blank" rel="noopener noreferrer">
                  {url.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </details>
      <div className="direction-actions direction-maintenance">
        <button
          data-archive-direction
          className="button"
          disabled={busy}
          onClick={() => void archive()}
        >
          {archived ? 'Desarquivar' : 'Arquivar'} {noun}
        </button>
        <ConfirmAction
          name={item.title}
          title={`Excluir ${noun}?`}
          description="Esta ação remove o item e desfaz seus vínculos. Você poderá desfazer para restaurar os dados e relações."
          className="button"
          disabled={busy}
          onConfirm={async () => {
            if (await useDirections.getState().remove(type, item.id))
              onRemoved()
          }}
        >
          Excluir {noun}
        </ConfirmAction>
      </div>
    </div>
  )
}
