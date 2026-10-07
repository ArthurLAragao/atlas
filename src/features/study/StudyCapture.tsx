import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import { taskSchema } from '../../data/models'
import { parseTaskInput } from '../../lib/task-parser'
import { base, Field, StudyForm, text } from './StudyForm'
import { studyChange } from './study-store'
import type { StudyKind } from './StudyEditors'

export function StudyCapture({
  kind,
  id,
  eventId,
  stepId,
  initialTitle,
  onClose,
}: {
  kind: StudyKind
  id: string
  eventId?: string
  stepId?: string
  initialTitle?: string
  onClose: () => void
}) {
  return (
    <StudyForm
      title="Criar tarefa vinculada"
      onClose={onClose}
      submit="Criar tarefa"
      onSubmit={async (values) => {
        const parsed = parseTaskInput(text(values, 'title'), new Date())
        const subject = useData
          .getState()
          .data.subjects.find((item) => item.id === id)
        const event = subject?.events.find((item) => item.id === eventId)
        const task = taskSchema.parse({
          ...base(),
          title: parsed.title,
          tags: parsed.tags,
          priority: parsed.priority,
          dueDate: parsed.dueDate ?? event?.date ?? null,
          dueTime: parsed.dueTime,
          status: 'todo',
          context: 'Faculdade',
          subtasks: [],
          repeat: null,
          focusMinutes: 0,
        })
        return studyChange(
          async () =>
            (await repository.createStudyTask(kind, id, task, eventId, stepId))
              .data,
          'Tarefa criada e vinculada.',
        )
      }}
    >
      <Field
        label="Título da tarefa"
        name="title"
        value={initialTitle}
        required
      />
      <p className="direction-help">
        Você pode escrever “revisar amanhã 19h #faculdade”. A tarefa ficará
        ligada a este estudo.
      </p>
    </StudyForm>
  )
}
