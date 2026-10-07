import { ConfirmAction } from '../../components/ConfirmAction'
import { PinButton } from '../profile/PinButton'
import { Link } from 'react-router-dom'
import { Check, Circle } from 'lucide-react'
import type { StudyPath } from '../../data/models'
import { repository } from '../../data/service'
import { useData } from '../../app/data-store'
import { PageHeader } from '../../components/PageHeader'
import { pathProgress } from '../../lib/study'
import { directionHref } from '../../lib/goals'
import { StudyRelations } from './StudyRelations'
import { studyChange } from './study-store'
import { useActiveForm } from '../goals/use-active-form'

export function PathDetail({
  path,
  onEdit,
  onStep,
  onTask,
  onLink,
  onRemoved,
}: {
  path: StudyPath
  onEdit: () => void
  onStep: (step?: StudyPath['steps'][number]) => void
  onTask: (step?: StudyPath['steps'][number]) => void
  onLink: (type: 'tasks' | 'notes') => void
  onRemoved: () => void
}) {
  const busy = useData((state) => state.busy)
  const active = useActiveForm()
  const progress = pathProgress(path)
  const archived = path.status === 'archived'
  return (
    <article className="direction-detail">
      <Link className="direction-external" to="/estudos">
        Voltar para Estudos
      </Link>
      <PageHeader title={path.title} eyebrow="Trilha de estudo">
        {path.status === 'active'
          ? 'Ativa'
          : path.status === 'completed'
            ? 'Concluída'
            : 'Arquivada'}
        {path.isExample ? ' · Exemplo' : ''}
      </PageHeader>
      <PinButton type="studyPaths" id={path.id} />
      <p className="direction-description">{path.description}</p>
      <div className="direction-progress-value">
        <strong>{progress.percent}%</strong>
        <span>
          {progress.done} de {progress.total} etapas concluídas
        </span>
      </div>
      <progress
        max={100}
        value={progress.percent}
        aria-label={`Progresso de ${path.title}`}
      />
      <p className="direction-help">
        {progress.next
          ? `Próximo passo: ${progress.next.title}`
          : progress.total
            ? 'Etapas concluídas. Escolha uma prática pequena para consolidar.'
            : 'Adicione uma etapa pequena para começar.'}
      </p>
      {!archived && (
        <div className="direction-actions">
          <button className="button" disabled={busy} onClick={onEdit}>
            Editar trilha
          </button>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => onStep()}
          >
            Adicionar etapa
          </button>
          <button className="button" disabled={busy} onClick={() => onTask()}>
            Criar tarefa
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => onLink('tasks')}
          >
            Vincular tarefa
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => onLink('notes')}
          >
            Vincular nota
          </button>
        </div>
      )}
      <section className="direction-section">
        <h2>Um passo de cada vez</h2>
        <ul className="direction-key-results">
          {path.steps.map((step) => (
            <li key={step.id}>
              <div className="direction-actions">
                <button
                  className="icon-button"
                  disabled={busy || archived}
                  aria-label={`${step.done ? 'Reabrir' : 'Concluir'} etapa ${step.title}`}
                  aria-pressed={step.done}
                  onClick={() =>
                    void studyChange(
                      async () =>
                        (
                          await repository.saveStudy(
                            'studyPaths',
                            {
                              ...path,
                              steps: path.steps.map((item) =>
                                item.id === step.id
                                  ? { ...item, done: !item.done }
                                  : item,
                              ),
                            },
                            path.updatedAt,
                          )
                        ).data,
                      step.done ? 'Etapa reaberta.' : 'Etapa concluída.',
                    )
                  }
                >
                  {step.done ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Circle aria-hidden="true" />
                  )}
                </button>
                <strong>{step.title}</strong>
              </div>
              {step.estimatedMinutes && (
                <span className="caption">
                  Estimativa: {step.estimatedMinutes} min
                </span>
              )}
              {step.url && (
                <a
                  className="direction-external"
                  href={step.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir material (nova aba)
                </a>
              )}
              {step.noteId && (
                <Link
                  className="direction-external"
                  to={directionHref('notes', step.noteId)}
                >
                  Abrir nota vinculada
                </Link>
              )}
              {step.taskId && (
                <Link
                  className="direction-external"
                  to={directionHref('tasks', step.taskId)}
                >
                  Abrir tarefa vinculada
                </Link>
              )}
              {!archived && (
                <div className="direction-actions">
                  <button
                    className="button"
                    disabled={busy}
                    aria-label={`Editar etapa ${step.title}`}
                    onClick={() => onStep(step)}
                  >
                    Editar
                  </button>
                  {!step.taskId && (
                    <button
                      className="button"
                      disabled={busy}
                      aria-label={`Criar tarefa para ${step.title}`}
                      onClick={() => onTask(step)}
                    >
                      Criar tarefa
                    </button>
                  )}
                  <ConfirmAction
                    name={step.title}
                    title="Excluir esta etapa?"
                    description="Esta ação remove o registro. Você poderá desfazer para recuperar os dados e vínculos."
                    className="button"
                    disabled={busy}
                    aria-label={`Excluir etapa ${step.title}`}
                    onConfirm={() =>
                      void studyChange(
                        async () =>
                          (
                            await repository.saveStudy(
                              'studyPaths',
                              {
                                ...path,
                                steps: path.steps.filter(
                                  (item) => item.id !== step.id,
                                ),
                              },
                              path.updatedAt,
                            )
                          ).data,
                        'Etapa excluída. Você pode desfazer.',
                      )
                    }
                  >
                    Excluir
                  </ConfirmAction>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <StudyRelations kind="studyPaths" item={path} />
      <p className="direction-help">
        {path.tags.map((tag) => `#${tag}`).join(' ')}
      </p>
      <div className="direction-maintenance">
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void studyChange(
              () => repository.archiveStudy('studyPaths', path.id, !archived),
              'Estado da trilha atualizado. Você pode desfazer.',
            ).then((ok) => {
              if (ok && active.current) onRemoved()
            })
          }
        >
          {archived ? 'Desarquivar trilha' : 'Arquivar trilha'}
        </button>
        <ConfirmAction
          name={path.title}
          title="Excluir esta trilha?"
          description="Esta ação remove o registro. Você poderá desfazer para recuperar os dados e vínculos."
          className="button danger"
          disabled={busy}
          onConfirm={() =>
            void studyChange(
              () => repository.removeStudy('studyPaths', path.id),
              'Trilha excluída. Você pode desfazer.',
              {
                ...useData.getState().data,
                studyPaths: useData
                  .getState()
                  .data.studyPaths.filter((item) => item.id !== path.id),
              },
            ).then((ok) => {
              if (ok && active.current) onRemoved()
            })
          }
        >
          Excluir trilha
        </ConfirmAction>
      </div>
    </article>
  )
}
