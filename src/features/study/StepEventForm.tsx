import { useData } from '../../app/data-store'
import type { Subject, StudyPath } from '../../data/models'
import { subjectSchema, studyPathSchema } from '../../data/models'
import { repository } from '../../data/service'
import { studyChange } from './study-store'
import { Field, number, optional, StudyForm, text } from './StudyForm'

export function StepEventForm({
  subject,
  path,
  event,
  step,
  onClose,
}: {
  subject?: Subject
  path?: StudyPath
  event?: Subject['events'][number]
  step?: StudyPath['steps'][number]
  onClose: () => void
}) {
  const data = useData((state) => state.data)
  return (
    <StudyForm
      title={
        subject
          ? event
            ? 'Editar prova ou entrega'
            : 'Nova prova ou entrega'
          : step
            ? 'Editar etapa'
            : 'Adicionar etapa'
      }
      onClose={onClose}
      onSubmit={async (values) => {
        if (subject) {
          const item = {
            id: event?.id ?? crypto.randomUUID(),
            title: text(values, 'title'),
            date: text(values, 'date'),
            kind: text(values, 'kind'),
            status: text(values, 'status'),
            description: text(values, 'description'),
            taskId: optional(values, 'taskId'),
          }
          const result = subjectSchema.safeParse({
            ...subject,
            events: event
              ? subject.events.map((record) =>
                  record.id === item.id ? item : record,
                )
              : [...subject.events, item],
          })
          if (!result.success)
            throw new Error(
              'Informe um nome e uma data válida para a prova ou entrega. A descrição aceita até 10.000 caracteres.',
            )
          return studyChange(
            async () =>
              (
                await repository.saveStudy(
                  'subjects',
                  result.data,
                  subject.updatedAt,
                )
              ).data,
            'Prova ou entrega salva.',
          )
        }
        if (!path) return false
        const item = {
          id: step?.id ?? crypto.randomUUID(),
          title: text(values, 'title'),
          done: step?.done ?? false,
          url: optional(values, 'url'),
          estimatedMinutes: number(values, 'estimatedMinutes'),
          noteId: optional(values, 'noteId'),
          taskId: optional(values, 'taskId'),
        }
        const result = studyPathSchema.safeParse({
          ...path,
          steps: step
            ? path.steps.map((record) =>
                record.id === item.id ? item : record,
              )
            : [...path.steps, item],
        })
        if (!result.success)
          throw new Error(
            'Informe o título da etapa. Use um link http ou https e uma estimativa em minutos maior que zero.',
          )
        return studyChange(
          async () =>
            (
              await repository.saveStudy(
                'studyPaths',
                result.data,
                path.updatedAt,
              )
            ).data,
          'Etapa salva.',
        )
      }}
    >
      <Field
        label={subject ? 'Nome da prova ou entrega' : 'Título da etapa'}
        name="title"
        value={event?.title ?? step?.title}
        required
      />
      {subject ? (
        <>
          <label>
            Tipo
            <select name="kind" defaultValue={event?.kind ?? 'exam'}>
              <option value="exam">Prova</option>
              <option value="delivery">Entrega</option>
            </select>
          </label>
          <Field
            label="Data"
            name="date"
            type="date"
            value={event?.date}
            required
          />
          <label>
            Estado
            <select name="status" defaultValue={event?.status ?? 'pending'}>
              <option value="pending">Pendente</option>
              <option value="completed">Concluída</option>
            </select>
          </label>
          <label>
            Descrição
            <textarea
              name="description"
              defaultValue={event?.description}
              maxLength={10000}
            />
          </label>
        </>
      ) : (
        <>
          <Field label="Link" name="url" type="url" value={step?.url} />
          <Field
            label="Estimativa em minutos"
            name="estimatedMinutes"
            type="number"
            value={step?.estimatedMinutes}
            min={1}
            max={10000}
          />
          <label>
            Nota vinculada
            <select name="noteId" defaultValue={step?.noteId ?? ''}>
              <option value="">Sem nota</option>
              {data.notes
                .filter((item) => !item.archivedAt || item.id === step?.noteId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      <label>
        Tarefa vinculada
        <select
          name="taskId"
          defaultValue={event?.taskId ?? step?.taskId ?? ''}
        >
          <option value="">Sem tarefa</option>
          {data.tasks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
    </StudyForm>
  )
}
