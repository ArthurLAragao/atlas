import { useId, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useData } from '../../app/data-store'
import { EntrySheet } from '../../components/EntrySheet'
import { goalSchema, type Goal } from '../../data/models'
import { dateKey } from '../../lib/habits'
import { formatTaskDate } from '../../lib/tasks'
import { weekEnd } from '../../lib/today'
import { useToday } from './today-store'

export function WeeklyGoalForm({
  goal,
  onClose,
}: {
  goal?: Goal
  onClose: () => void
}) {
  const goals = useData((state) => state.data.goals)
  const [selected, setSelected] = useState(goal)
  const [title, setTitle] = useState(goal?.title ?? '')
  const [deadline, setDeadline] = useState<string | null>(() =>
    goal ? goal.deadline : weekEnd(dateKey(new Date())),
  )
  const [error, setError] = useState('')
  const [links, setLinks] = useState(goal?.links ?? [])
  const [taskToAdd, setTaskToAdd] = useState('')
  const [page, setPage] = useState(0)
  const busy = useData((state) => state.busy)
  const tasks = useData((state) => state.data.tasks)
  const help = useId()
  const linkHelp = useId()
  const taskPicker = useRef<HTMLSelectElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const incoming = new Set(
    selected
      ? tasks
          .filter((task) =>
            task.links.some(
              (link) => link.type === 'goals' && link.id === selected.id,
            ),
          )
          .map((task) => task.id)
      : [],
  )
  const linkedIds = new Set([
    ...links.filter((link) => link.type === 'tasks').map((link) => link.id),
    ...incoming,
  ])
  const orderedTasks = [...tasks].sort(
    (left, right) =>
      left.title.localeCompare(right.title, 'pt-BR') ||
      left.id.localeCompare(right.id),
  )
  const linked = orderedTasks.filter((task) => linkedIds.has(task.id))
  const available = orderedTasks.filter((task) => !linkedIds.has(task.id))
  const pageSize = 20
  const lastPage = Math.max(0, Math.ceil(linked.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const pageTasks = linked.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  )

  function addLink() {
    if (busy || !taskToAdd || links.length >= 200 || linkedIds.has(taskToAdd))
      return
    const task = tasks.find((record) => record.id === taskToAdd)
    if (!task) return
    setLinks((current) => [...current, { type: 'tasks', id: task.id }])
    setPage(
      Math.floor(
        orderedTasks
          .filter((record) => linkedIds.has(record.id) || record.id === task.id)
          .findIndex((record) => record.id === task.id) / pageSize,
      ),
    )
    setTaskToAdd('')
    setError('')
    requestAnimationFrame(() => {
      if (taskPicker.current && !taskPicker.current.disabled)
        taskPicker.current.focus()
      else saveButton.current?.focus()
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const existingTags = selected?.tags ?? []
    const tags =
      existingTags.length >= 50 ||
      existingTags.some(
        (tag) => tag.normalize('NFC').toLocaleLowerCase('pt-BR') === 'semana',
      )
        ? existingTags
        : [...existingTags, 'semana']
    const now = new Date().toISOString()
    const parsed = goalSchema.safeParse({
      ...selected,
      id: selected?.id ?? crypto.randomUUID(),
      title,
      deadline,
      tags,
      links,
      keyResults: selected?.keyResults ?? [],
      createdAt: selected?.createdAt ?? now,
      updatedAt: selected?.updatedAt ?? now,
      weekly: true,
      status: selected?.status ?? 'active',
      isExample: false,
    })
    if (!parsed.success) {
      setError('Digite um nome para a meta, com até 240 caracteres.')
      return
    }
    if (await useToday.getState().saveGoal(parsed.data)) onClose()
    else setError(useToday.getState().error ?? 'Tente salvar novamente.')
  }

  return (
    <EntrySheet
      title="Meta da semana"
      description="Escolha uma direção simples para esta semana."
      onClose={onClose}
    >
      <form
        className="task-form"
        aria-busy={busy}
        onSubmit={(event) => void submit(event)}
      >
        {!goal && (
          <label className="task-field">
            Usar meta existente
            <select
              disabled={busy}
              value={selected?.id ?? ''}
              onChange={(event) => {
                const next = goals.find(
                  (item) => item.id === event.target.value,
                )
                setSelected(next)
                setTitle(next?.title ?? '')
                setDeadline(next ? next.deadline : weekEnd(dateKey(new Date())))
                setLinks(next?.links ?? [])
                setTaskToAdd('')
                setPage(0)
              }}
            >
              <option value="">Criar uma nova meta</option>
              {goals
                .filter((item) => item.status !== 'archived')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="task-field">
          Nome da meta
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
        <p id={help} className="task-help">
          {deadline
            ? `Até ${formatTaskDate(deadline)}.`
            : 'Sem prazo definido.'}{' '}
          O progresso acompanha as tarefas vinculadas, separado dos
          resultados-chave manuais.
        </p>
        <fieldset className="subtask-editor">
          <legend>Tarefas desta meta · {linked.length}</legend>
          {linked.length > 0 ? (
            <ul aria-label="Tarefas vinculadas">
              {pageTasks.map((task) => (
                <li key={task.id}>
                  <span className="task-name">
                    <strong>{task.title}</strong>
                    {incoming.has(task.id) && (
                      <span className="caption">Vínculo na tarefa</span>
                    )}
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    disabled={busy || incoming.has(task.id)}
                    aria-label={`Desvincular ${task.title}`}
                    onClick={() => {
                      setLinks((current) =>
                        current.filter(
                          (link) =>
                            link.type !== 'tasks' || link.id !== task.id,
                        ),
                      )
                      requestAnimationFrame(() => taskPicker.current?.focus())
                    }}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="task-help">
              Vincule uma tarefa para acompanhar o progresso.
            </p>
          )}
          {linked.length > pageSize && (
            <div className="button-row">
              <button
                type="button"
                className="button"
                disabled={busy || currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Vínculos anteriores
              </button>
              <span className="caption">
                {currentPage + 1} de {lastPage + 1}
              </span>
              <button
                type="button"
                className="button"
                disabled={busy || currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                Próximos vínculos
              </button>
            </div>
          )}
          <div className="quick-task-line">
            <label className="task-field">
              Vincular tarefa
              <select
                ref={taskPicker}
                aria-label="Vincular tarefa"
                aria-describedby={linkHelp}
                value={taskToAdd}
                disabled={busy || links.length >= 200 || !available.length}
                onChange={(event) => setTaskToAdd(event.target.value)}
              >
                <option value="">Escolha uma tarefa</option>
                {available.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button"
              disabled={busy || !taskToAdd || links.length >= 200}
              onClick={addLink}
            >
              Adicionar vínculo
            </button>
          </div>
          <p id={linkHelp} className="task-help">
            {links.length >= 200
              ? 'Esta meta já tem 200 vínculos. Remova um para adicionar outra tarefa.'
              : 'Alterações são guardadas ao salvar. Vínculos existentes na tarefa são mantidos.'}
          </p>
        </fieldset>
        {error && (
          <p className="task-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            ref={saveButton}
            className="button task-primary"
            disabled={busy}
          >
            Salvar meta
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
