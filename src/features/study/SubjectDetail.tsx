import { ConfirmAction } from '../../components/ConfirmAction'
import { Link } from 'react-router-dom'
import { CalendarClock, AlertCircle } from 'lucide-react'
import type { Subject } from '../../data/models'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import { PageHeader } from '../../components/PageHeader'
import { assessmentAverage, attendance, eventCountdown } from '../../lib/study'
import { directionHref } from '../../lib/goals'
import { studyChange } from './study-store'
import { StudyRelations } from './StudyRelations'
import { useActiveForm } from '../goals/use-active-form'

export function SubjectDetail({
  subject,
  onEdit,
  onAssessment,
  onEvent,
  onTask,
  onLink,
  onRemoved,
}: {
  subject: Subject
  onEdit: () => void
  onAssessment: (item?: Subject['assessments'][number]) => void
  onEvent: (item?: Subject['events'][number]) => void
  onTask: (event?: Subject['events'][number]) => void
  onLink: (type: 'tasks' | 'notes') => void
  onRemoved: () => void
}) {
  const busy = useData((state) => state.busy)
  const active = useActiveForm()
  const average = assessmentAverage(subject.assessments)
  const presence = attendance(subject)
  const archived = subject.status === 'archived'
  const save = (item: Subject, message: string) =>
    studyChange(
      async () =>
        (await repository.saveStudy('subjects', item, subject.updatedAt)).data,
      message,
    )
  return (
    <article className="direction-detail">
      <Link className="direction-external" to="/estudos">
        Voltar para Estudos
      </Link>
      <PageHeader title={subject.title} eyebrow="Disciplina">
        {subject.code || 'Sem código'} ·{' '}
        {subject.semester || 'Sem semestre definido'} ·{' '}
        {subject.status === 'active'
          ? 'Ativa'
          : subject.status === 'completed'
            ? 'Concluída'
            : 'Arquivada'}
        {subject.isExample ? ' · Exemplo' : ''}
      </PageHeader>
      {!archived && (
        <div className="direction-actions">
          <button className="button" disabled={busy} onClick={onEdit}>
            Editar disciplina
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
        <h2>Avaliações</h2>
        <div className="direction-progress-value">
          <strong>
            {average.value === null
              ? '—'
              : average.value.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                })}{' '}
            / 10
          </strong>
          <span>{average.label}</span>
        </div>
        {!archived && (
          <button
            className="button"
            disabled={busy}
            onClick={() => onAssessment()}
          >
            Adicionar avaliação
          </button>
        )}
        <ul className="direction-related">
          {subject.assessments.map((item) => (
            <li key={item.id}>
              <div className="study-row-text">
                <strong>{item.title}</strong>
                <span>
                  {item.score} / {item.maxScore}
                  {item.weight !== null ? ` · Peso ${item.weight}` : ''}
                  {item.date
                    ? ` · ${item.date.split('-').reverse().join('/')}`
                    : ''}
                </span>
                {item.notes && (
                  <p className="direction-description">{item.notes}</p>
                )}
              </div>
              {!archived && (
                <>
                  <button
                    className="button"
                    disabled={busy}
                    aria-label={`Editar avaliação ${item.title}`}
                    onClick={() => onAssessment(item)}
                  >
                    Editar
                  </button>
                  <ConfirmAction
                    name={item.title}
                    title="Excluir esta avaliação?"
                    description="Esta ação remove o registro. Você poderá desfazer para recuperar os dados e vínculos."
                    className="button"
                    disabled={busy}
                    aria-label={`Excluir avaliação ${item.title}`}
                    onConfirm={() =>
                      void save(
                        {
                          ...subject,
                          assessments: subject.assessments.filter(
                            (record) => record.id !== item.id,
                          ),
                        },
                        'Avaliação excluída. Você pode desfazer.',
                      )
                    }
                  >
                    Excluir
                  </ConfirmAction>
                </>
              )}
            </li>
          ))}
        </ul>
        {!subject.assessments.length && (
          <p className="direction-help">
            Adicione a primeira avaliação para acompanhar sua média.
          </p>
        )}
      </section>
      <section className="direction-section">
        <h2>Presença</h2>
        <p className="direction-number">
          {subject.absences} {subject.absences === 1 ? 'falta' : 'faltas'}
          {subject.absenceLimit !== null
            ? ` · Limite ${subject.absenceLimit}`
            : ''}
        </p>
        <p className={presence.overLimit ? 'data-error' : 'direction-help'}>
          {presence.overLimit && (
            <>
              <AlertCircle aria-hidden="true" /> Limite de faltas excedido.{' '}
            </>
          )}
          {presence.label}
          {presence.remaining !== null && !presence.overLimit
            ? ` Restam ${presence.remaining} faltas até o limite.`
            : ''}
        </p>
        {!archived && (
          <div className="direction-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void save(
                  { ...subject, absences: subject.absences + 1 },
                  'Falta registrada.',
                )
              }
            >
              Registrar falta
            </button>
            <button
              className="button"
              disabled={busy || !subject.absences}
              onClick={() =>
                void save(
                  { ...subject, absences: Math.max(0, subject.absences - 1) },
                  'Última falta removida. Você pode desfazer.',
                )
              }
            >
              Remover última falta
            </button>
          </div>
        )}
      </section>
      <section className="direction-section">
        <h2>Provas e entregas</h2>
        {!archived && (
          <button className="button" disabled={busy} onClick={() => onEvent()}>
            Nova prova ou entrega
          </button>
        )}
        <ul className="direction-key-results">
          {[...subject.events]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((item) => {
              const countdown = eventCountdown(item, new Date())
              return (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span
                    className={
                      countdown.state === 'overdue'
                        ? 'data-error'
                        : 'direction-help'
                    }
                  >
                    <CalendarClock aria-hidden="true" />{' '}
                    {item.kind === 'exam' ? 'Prova' : 'Entrega'} ·{' '}
                    {item.date.split('-').reverse().join('/')} ·{' '}
                    {countdown.label}
                  </span>
                  {item.description && (
                    <p className="direction-description">{item.description}</p>
                  )}
                  {item.taskId && (
                    <Link
                      className="direction-external"
                      to={directionHref('tasks', item.taskId)}
                    >
                      Abrir tarefa vinculada
                    </Link>
                  )}
                  {!archived && (
                    <div className="direction-actions">
                      <button
                        className="button"
                        disabled={busy}
                        aria-label={`Editar ${item.title}`}
                        onClick={() => onEvent(item)}
                      >
                        Editar
                      </button>
                      {!item.taskId && (
                        <button
                          className="button"
                          disabled={busy}
                          aria-label={`Criar tarefa para ${item.title}`}
                          onClick={() => onTask(item)}
                        >
                          Criar tarefa
                        </button>
                      )}
                      <ConfirmAction
                        name={item.title}
                        title="Excluir esta prova ou entrega?"
                        description="Esta ação remove o registro. Você poderá desfazer para recuperar os dados e vínculos."
                        className="button"
                        disabled={busy}
                        aria-label={`Excluir ${item.title}`}
                        onConfirm={() =>
                          void save(
                            {
                              ...subject,
                              events: subject.events.filter(
                                (record) => record.id !== item.id,
                              ),
                            },
                            'Prova ou entrega excluída. Você pode desfazer.',
                          )
                        }
                      >
                        Excluir
                      </ConfirmAction>
                    </div>
                  )}
                </li>
              )
            })}
        </ul>
        {!subject.events.length && (
          <p className="direction-help">
            Anote a próxima prova ou entrega e crie uma tarefa para começar.
          </p>
        )}
      </section>
      <StudyRelations kind="subjects" item={subject} />
      <details className="direction-section">
        <summary>Detalhes da disciplina</summary>
        <p>
          {subject.professor
            ? `Professor: ${subject.professor}`
            : 'Professor não informado.'}
          {subject.hours ? ` · ${subject.hours} h` : ''}
        </p>
        <p className="direction-description">
          {subject.notes || 'Sem anotações.'}
        </p>
        <p>{subject.tags.map((tag) => `#${tag}`).join(' ')}</p>
      </details>
      <div className="direction-maintenance">
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void studyChange(
              () => repository.archiveStudy('subjects', subject.id, !archived),
              archived
                ? 'Disciplina desarquivada.'
                : 'Disciplina arquivada. Você pode desfazer.',
            ).then((ok) => {
              if (ok && active.current) onRemoved()
            })
          }
        >
          {archived ? 'Desarquivar disciplina' : 'Arquivar disciplina'}
        </button>
        <ConfirmAction
          name={subject.title}
          title="Excluir esta disciplina?"
          description="Esta ação remove o registro. Você poderá desfazer para recuperar os dados e vínculos."
          className="button danger"
          disabled={busy}
          onConfirm={() =>
            void studyChange(
              () => repository.removeStudy('subjects', subject.id),
              'Disciplina excluída. Você pode desfazer.',
              {
                ...useData.getState().data,
                subjects: useData
                  .getState()
                  .data.subjects.filter((item) => item.id !== subject.id),
              },
            ).then((ok) => {
              if (ok && active.current) onRemoved()
            })
          }
        >
          Excluir disciplina
        </ConfirmAction>
      </div>
    </article>
  )
}
