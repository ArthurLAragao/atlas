import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Subject, StudyPath } from '../../data/models'
import { directionHref } from '../../lib/goals'
import { StudyForm, text } from './StudyForm'
import { studyChange } from './study-store'
import { FocusTotal } from '../../components/FocusTotal'
import type { StudyKind } from './StudyEditors'

export function StudyRelationForm({
  kind,
  item,
  target,
  onClose,
}: {
  kind: StudyKind
  item: Subject | StudyPath
  target: 'tasks' | 'notes'
  onClose: () => void
}) {
  const data = useData((state) => state.data)
  const choices = data[target].filter(
    (record) => !('archivedAt' in record && record.archivedAt),
  )
  return (
    <StudyForm
      title={target === 'tasks' ? 'Vincular tarefa' : 'Vincular nota'}
      onClose={onClose}
      submit="Vincular"
      onSubmit={(values) =>
        studyChange(
          () =>
            repository.linkStudy(
              kind,
              item.id,
              target,
              text(values, 'target'),
              true,
            ),
          'Vínculo adicionado.',
        )
      }
    >
      <label>
        {target === 'tasks' ? 'Tarefa' : 'Nota'}
        <select name="target" required defaultValue="">
          <option value="" disabled>
            Escolha um registro
          </option>
          {choices.map((record) => (
            <option value={record.id} key={record.id}>
              {record.title}
            </option>
          ))}
        </select>
      </label>
      {!choices.length && (
        <p>
          Crie uma {target === 'tasks' ? 'tarefa' : 'nota'} primeiro, depois
          volte para vinculá-la.
        </p>
      )}
    </StudyForm>
  )
}
export function StudyRelations({
  kind,
  item,
}: {
  kind: StudyKind
  item: Subject | StudyPath
}) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const linked = (
    target: 'tasks' | 'notes',
    id: string,
    links: Subject['links'],
  ) =>
    item.links.some((link) => link.type === target && link.id === id) ||
    links.some((link) => link.type === kind && link.id === item.id) ||
    ('events' in item
      ? item.events.some((event) => target === 'tasks' && event.taskId === id)
      : item.steps.some(
          (step) => (target === 'tasks' ? step.taskId : step.noteId) === id,
        ))
  const tasks = data.tasks.filter((record) =>
    linked('tasks', record.id, record.links),
  )
  const notes = data.notes.filter((record) =>
    linked('notes', record.id, record.links),
  )
  return (
    <section className="direction-section">
      <h2>Conhecimento e ações</h2>
      <FocusTotal type={kind} id={item.id} />
      {tasks.length + notes.length === 0 && (
        <p className="direction-help">
          Vincule uma tarefa ou nota para encontrar o próximo passo aqui.
        </p>
      )}
      <ul className="direction-related">
        {tasks.map((record) => (
          <li key={record.id}>
            <Link to={directionHref('tasks', record.id)}>
              {record.title} · Tarefa
            </Link>
            {item.status !== 'archived' && (
              <button
                className="button"
                disabled={busy}
                aria-label={`Desvincular ${record.title}`}
                onClick={() =>
                  void studyChange(
                    () =>
                      repository.linkStudy(
                        kind,
                        item.id,
                        'tasks',
                        record.id,
                        false,
                      ),
                    'Vínculo removido.',
                  )
                }
              >
                Desvincular
              </button>
            )}
          </li>
        ))}
        {notes.map((record) => (
          <li key={record.id}>
            <Link to={directionHref('notes', record.id)}>
              {record.title} · Nota
            </Link>
            {item.status !== 'archived' && (
              <button
                className="button"
                disabled={busy}
                aria-label={`Desvincular ${record.title}`}
                onClick={() =>
                  void studyChange(
                    () =>
                      repository.linkStudy(
                        kind,
                        item.id,
                        'notes',
                        record.id,
                        false,
                      ),
                    'Vínculo removido.',
                  )
                }
              >
                Desvincular
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
