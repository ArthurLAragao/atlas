import { DateField } from '../../components/DateField'
import { useId, useState, type FormEvent } from 'react'
import { useData } from '../../app/data-store'
import { EntrySheet } from '../../components/EntrySheet'
import { taskSchema, type Task } from '../../data/models'
import { dateKey } from '../../lib/habits'
import { useTasks } from '../tasks/task-store'

export function AppointmentForm({
  task,
  onClose,
}: {
  task?: Task
  onClose: () => void
}) {
  const today = dateKey(new Date())
  const [title, setTitle] = useState(task?.title ?? '')
  const [date, setDate] = useState(task?.dueDate ?? today)
  const [time, setTime] = useState(task?.dueTime ?? '')
  const [error, setError] = useState('')
  const busy = useData((state) => state.busy)
  const help = useId()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const current = new Date()
    const currentDay = dateKey(current)
    if (date < currentDay) {
      setError('Escolha hoje ou uma data futura para o compromisso.')
      return
    }
    const currentTime = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
    if (date === currentDay && time && time < currentTime) {
      setError('Escolha um horário que ainda não passou ou uma data futura.')
      return
    }
    const tags = task?.tags.some(
      (tag) =>
        tag.normalize('NFC').toLocaleLowerCase('pt-BR') === 'compromisso',
    )
      ? task.tags
      : [...(task?.tags ?? []), 'compromisso']
    if (tags.length > 50) {
      setError(
        'Esta tarefa já tem 50 tags. Remova uma em Tarefas para adicionar #compromisso.',
      )
      return
    }
    const now = new Date().toISOString()
    const parsed = taskSchema.safeParse({
      id: task?.id ?? crypto.randomUUID(),
      title,
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'medium',
      dueDate: date,
      dueTime: time,
      context: task ? task.context : 'Pessoal',
      subtasks: task?.subtasks ?? [],
      repeat: task?.repeat ?? null,
      focusMinutes: task?.focusMinutes ?? 0,
      tags,
      links: task?.links ?? [],
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      isExample: false,
    })
    if (!parsed.success) {
      setError('Revise o nome, a data e o horário do compromisso.')
      return
    }
    if (await useTasks.getState().save(parsed.data, task?.updatedAt ?? null)) onClose()
    else setError(useTasks.getState().error ?? 'Tente salvar novamente.')
  }

  return (
    <EntrySheet
      title="Próximo compromisso"
      description="Anote quando acontece para ter o próximo horário à vista."
      onClose={onClose}
    >
      <form
        className="task-form"
        aria-busy={busy}
        onSubmit={(event) => void submit(event)}
      >
        <label className="task-field">
          Nome do compromisso
          <input
            autoFocus
            required
            maxLength={240}
            value={title}
            disabled={busy}
            aria-describedby={help}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="task-form-columns">
          <label className="task-field">
            Data do compromisso
            <DateField
              label="Data do compromisso"
              required
              min={today}
              max="9999-12-31"
              value={date}
              disabled={busy}
              onValueChange={setDate}
            />
          </label>
          <label className="task-field">
            Horário do compromisso
            <input
              type="time"
              required
              value={time}
              disabled={busy}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
        </div>
        <p id={help} className="task-help">
          Registro manual. Também aparece em Tarefas com a tag #compromisso.
        </p>
        {error && (
          <p className="task-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="button task-primary" disabled={busy}>
            Salvar compromisso
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
