import { ConfirmAction } from '../../components/ConfirmAction'
import { DateField } from '../../components/DateField'
import { useId, useState, type FormEvent } from 'react'
import { addDays } from 'date-fns'
import { taskSchema, type Task } from '../../data/models'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { usePreferences } from '../../app/preferences-store'
import { dateKey } from '../../lib/habits'
import { taskPriorityLabels } from '../../lib/tasks'
import { useTasks } from './task-store'
import { SubtaskEditor } from './SubtaskEditor'
import { FocusTotal } from '../../components/FocusTotal'

export function TaskForm({
  task,
  initialDate,
  initialStatus,
  onClose,
}: {
  task?: Task
  initialDate?: string
  initialStatus?: Task['status']
  onClose: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [priority, setPriority] = useState<Task['priority']>(
    task?.priority ?? 'medium',
  )
  const [date, setDate] = useState(task?.dueDate ?? initialDate ?? '')
  const [time, setTime] = useState(task?.dueTime ?? '')
  const [context, setContext] = useState(task?.context ?? '')
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '')
  const [subtasks, setSubtasks] = useState(task?.subtasks ?? [])
  const [unit, setUnit] = useState(task?.repeat?.unit ?? '')
  const [interval, setInterval] = useState(String(task?.repeat?.interval ?? 1))
  const [error, setError] = useState('')
  const busy = useData((state) => state.busy)
  const contexts = usePreferences((state) => state.preferences.contexts)
  const contextId = useId()
  const tagHelp = useId()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (time && !date) {
      setError('Escolha uma data para usar o horário.')
      return
    }
    const now = new Date().toISOString()
    const parsed = taskSchema.safeParse({
      id: task?.id ?? crypto.randomUUID(),
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      isExample: false,
      links: task?.links ?? [],
      focusMinutes: task?.focusMinutes ?? 0,
      title,
      priority,
      status: task?.status ?? initialStatus ?? 'todo',
      dueDate: date || null,
      dueTime: time || null,
      context: context.trim() || null,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean),
        ),
      ],
      subtasks,
      repeat: unit ? { unit, interval: Number(interval) } : null,
    })
    if (!parsed.success) {
      setError(
        'Revise o nome, as subtarefas, as tags e o intervalo de repetição (1 a 365).',
      )
      return
    }
    if (await useTasks.getState().save(parsed.data, task?.updatedAt ?? null)) onClose()
    else setError(useTasks.getState().error ?? 'Tente salvar novamente.')
  }
  return (
    <EntrySheet
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
      description="Um próximo passo claro. Os detalhes são opcionais."
      onClose={onClose}
    >
      {task && <FocusTotal type="tasks" id={task.id} />}
      <form
        className="task-form"
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
      >
        <label className="task-field">
          Nome
          <input
            autoFocus
            required
            maxLength={240}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="task-form-columns">
          <label className="task-field">
            Prazo
            <DateField
              label="Prazo"
              value={date}
              disabled={busy}
              onValueChange={setDate}
            />
          </label>
          <label className="task-field">
            Horário
            <input
              type="time"
              value={time}
              disabled={busy}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <label className="task-field">
            Prioridade
            <select
              aria-label="Prioridade"
              value={priority}
              disabled={busy}
              onChange={(event) =>
                setPriority(event.target.value as Task['priority'])
              }
            >
              {Object.entries(taskPriorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="task-field">
            Contexto
            <input
              list={contextId}
              maxLength={80}
              value={context}
              disabled={busy}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Escolha ou digite"
            />
            <datalist id={contextId}>
              {contexts.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="task-field">
          Tags
          <input
            aria-describedby={tagHelp}
            value={tags}
            disabled={busy}
            onChange={(event) => setTags(event.target.value)}
            placeholder="faculdade, aws"
          />
        </label>
        <p id={tagHelp} className="task-help">
          Separe por vírgulas. Até 50 tags de 60 caracteres.
        </p>
        <div className="task-form-columns">
          <label className="task-field">
            Repetição
            <select
              aria-label="Repetição"
              value={unit}
              disabled={busy}
              onChange={(event) => setUnit(event.target.value)}
            >
              <option value="">Não repetir</option>
              <option value="day">Dias</option>
              <option value="week">Semanas</option>
              <option value="month">Meses</option>
            </select>
          </label>
          {unit && (
            <label className="task-field">
              A cada
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                required
                value={interval}
                disabled={busy}
                onChange={(event) => setInterval(event.target.value)}
              />
            </label>
          )}
        </div>
        {unit && (
          <p className="task-help">
            Ao concluir, cria a próxima ocorrência futura com as subtarefas
            desmarcadas. A tarefa concluída fica no histórico.
          </p>
        )}
        <SubtaskEditor items={subtasks} onChange={setSubtasks} busy={busy} />
        {error && (
          <p role="alert" className="task-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="button task-primary" disabled={busy}>
            {task ? 'Salvar tarefa' : 'Criar tarefa'}
          </button>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
        {task && (
          <div className="task-form-secondary">
            {task.status !== 'done' && (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await useTasks
                      .getState()
                      .postpone(task, dateKey(addDays(new Date(), 1)))
                  )
                    onClose()
                  else
                    setError(
                      useTasks.getState().error ?? 'Tente adiar novamente.',
                    )
                }}
              >
                Adiar para amanhã
              </button>
            )}
            <p className="task-help">
              Excluir remove a tarefa e suas subtarefas. Você pode desfazer.
            </p>
            <ConfirmAction
              name={task.title}
              title="Excluir esta tarefa?"
              description="Esta ação remove a tarefa e suas subtarefas. Você poderá desfazer; tarefas com vínculos protegidos precisam ser desvinculadas antes."
              className="button task-danger"
              type="button"
              disabled={busy}
              onConfirm={async () => {
                if (await useTasks.getState().remove(task.id)) onClose()
                else
                  setError(
                    useTasks.getState().error ?? 'Tente excluir novamente.',
                  )
              }}
            >
              Excluir tarefa
            </ConfirmAction>
          </div>
        )}
      </form>
    </EntrySheet>
  )
}
