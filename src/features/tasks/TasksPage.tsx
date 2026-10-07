import { SelectMenu } from '../../components/SelectMenu'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { useData } from '../../app/data-store'
import { usePreferences } from '../../app/preferences-store'
import type { Task } from '../../data/models'
import { sortTasks } from '../../lib/tasks'
import { filterTasks, taskCounts } from '../../lib/task-filter'
import { useTasks } from './task-store'
import { QuickTask } from './QuickTask'
import { TaskForm } from './TaskForm'
import { TaskList } from './TaskList'
import { TransientToast } from '../../components/TransientToast'
import { TaskContexts } from './TaskContexts'
import '../../styles/tasks.css'

const TaskTable = lazy(() =>
  import('./TaskTable').then((m) => ({ default: m.TaskTable })),
)
const TaskKanban = lazy(() =>
  import('./TaskKanban').then((m) => ({ default: m.TaskKanban })),
)
const TaskCalendar = lazy(() =>
  import('./TaskCalendar').then((m) => ({ default: m.TaskCalendar })),
)
type View = 'list' | 'kanban' | 'calendar' | 'table'
type Sheet =
  | { type: 'task'; task?: Task; date?: string; status?: Task['status'] }
  | { type: 'contexts' }
export default function TasksPage() {
  const [params] = useSearchParams()
  const task = useData((state) =>
    state.data.tasks.find((item) => item.id === params.get('task')),
  )
  return (
    <TaskWorkspace
      key={`${params.get('search') ?? ''}:${params.get('task') ?? ''}`}
      initialQuery={params.get('search') ?? ''}
      initialTask={task}
    />
  )
}
function TaskWorkspace({
  initialQuery,
  initialTask,
}: {
  initialQuery: string
  initialTask?: Task
}) {
  const tasks = useData((state) => state.data.tasks)
  const busy = useData((state) => state.busy)
  const contexts = usePreferences((state) => state.preferences.contexts)
  const [view, setView] = useState<View>('list')
  const [query, setQuery] = useState(initialQuery)
  const [context, setContext] = useState('all')
  const [status, setStatus] = useState('all')
  const [sheet, setSheet] = useState<Sheet | null>(
    initialTask ? { type: 'task', task: initialTask } : null,
  )
  const canUndo = useTasks((state) => state.canUndo)
  const refreshUndo = useTasks((state) => state.refreshUndo)
  useEffect(() => {
    void refreshUndo()
  }, [refreshUndo])
  const visible = sortTasks(filterTasks(tasks, query, context, status))
  const counts = taskCounts(filterTasks(tasks, query, context, 'all'))
  const choices = [
    ...new Set([
      ...contexts,
      ...tasks.flatMap((task) => (task.context ? [task.context] : [])),
    ]),
  ]
  const props = {
    tasks: visible,
    busy,
    onEdit: (task: Task) => setSheet({ type: 'task', task }),
    onStatus: async (task: Task, value: Task['status']) => {
      const active = document.activeElement
      const control = active?.classList.contains('task-check')
        ? '.task-check'
        : '.task-status'
      if (await useTasks.getState().status(task, value)) {
        requestAnimationFrame(() => {
          const target = document.querySelector<HTMLElement>(
            `[data-task-id="${task.id}"] ${control}`,
          )
          ;(
            (status === 'all' || status === value ? target : null) ??
            document.querySelector<HTMLElement>('[data-new-task]')
          )?.focus()
        })
      }
    },
  }
  const newTask = (date?: string) => setSheet({ type: 'task', date })
  return (
    <div className="tasks-page">
      <PageHeader title="Tarefas" eyebrow="Um próximo passo de cada vez">
        Capture a ideia, escolha o que importa e faça acontecer.
      </PageHeader>
      <div className="section-heading">
        <div>
          <h2>Seu próximo passo</h2>
          <p className="task-help">
            {tasks.filter((task) => task.status !== 'done').length} pendentes ·{' '}
            {tasks.filter((task) => task.status === 'done').length} concluídas
          </p>
        </div>
        <button
          className="button"
          data-new-task
          disabled={busy}
          onClick={() => newTask()}
        >
          <Plus aria-hidden="true" /> Nova tarefa
        </button>
      </div>
      <QuickTask busy={busy} />
      {!sheet && <TaskFeedback />}
      <div className="task-view-controls">
        <fieldset className="task-segments">
          <legend className="sr-only">Visualização de tarefas</legend>
          {(
            [
              ['list', 'Lista'],
              ['kanban', 'Kanban'],
              ['calendar', 'Calendário'],
              ['table', 'Tabela'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="task-view"
                value={value}
                checked={view === value}
                onChange={() => setView(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <button
          className="button"
          onClick={() => setSheet({ type: 'contexts' })}
        >
          Editar contextos
        </button>
      </div>
      <div className="task-filters">
        <label className="task-field">
          Buscar tarefas
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, tag ou contexto"
          />
        </label>
        <label className="task-field">
          Contexto
          <SelectMenu
            label="Filtrar contexto"
            value={context}
            onChange={setContext}
            options={[
              { value: 'all', label: 'Todos os contextos' },
              { value: 'none', label: 'Sem contexto' },
              ...choices.map((value) => ({
                value: `context:${value}`,
                label: value,
              })),
            ]}
          />
        </label>
        <label className="task-field">
          Situação
          <SelectMenu
            label="Filtrar situação"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'todo', label: 'A fazer' },
              { value: 'doing', label: 'Fazendo' },
              { value: 'done', label: 'Feito' },
            ]}
          />
        </label>
      </div>
      {view === 'table' && (
        <fieldset className="task-segments table-filters">
          <legend className="sr-only">Situação na tabela</legend>
          {(
            [
              ['all', 'Todas'],
              ['todo', 'A fazer'],
              ['doing', 'Fazendo'],
              ['done', 'Feito'],
            ] as const
          ).map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="table-status"
                checked={status === value}
                onChange={() => setStatus(value)}
              />
              <span>
                {label} ({counts[value]})
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="task-result-count" role="status">
        {visible.length} {visible.length === 1 ? 'tarefa' : 'tarefas'} nesta
        visão
      </p>
      {view === 'table' ? (
        <Suspense fallback={<p role="status">Abrindo tabela.</p>}>
          <TaskTable {...props} />
        </Suspense>
      ) : view === 'calendar' ? (
        <Suspense fallback={<p role="status">Abrindo calendário.</p>}>
          <TaskCalendar {...props} onNew={newTask} />
        </Suspense>
      ) : view === 'kanban' ? (
        <Suspense fallback={<p role="status">Abrindo Kanban.</p>}>
          <TaskKanban
            {...props}
            onNew={(status) => setSheet({ type: 'task', status })}
          />
        </Suspense>
      ) : visible.length ? (
        <TaskList {...props} grouped />
      ) : (
        <div className="tasks-empty">
          <h2>
            {tasks.length
              ? 'Nenhuma tarefa encontrada'
              : 'Seu próximo passo começa aqui'}
          </h2>
          <p>
            {tasks.length
              ? 'Limpe os filtros ou capture uma nova tarefa acima.'
              : 'Digite uma tarefa na captura rápida e pressione Enter.'}
          </p>
          {tasks.length > 0 && (
            <button
              className="button"
              onClick={() => {
                setQuery('')
                setContext('all')
                setStatus('all')
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
      {canUndo && (
        <details className="task-undo">
          <summary>Última exclusão</summary>
          <p className="task-help">
            A última tarefa excluída pode ser recuperada.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void useTasks.getState().undo()}
          >
            Desfazer exclusão
          </button>
        </details>
      )}
      {sheet?.type === 'task' && (
        <TaskForm
          task={sheet.task}
          initialDate={sheet.date}
          initialStatus={sheet.status}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'contexts' && (
        <TaskContexts onClose={() => setSheet(null)} />
      )}
    </div>
  )
}
function TaskFeedback() {
  const { error, message, canUndo, dismiss, undo } = useTasks()
  const busy = useData((state) => state.busy)
  if (!error && !message) return null
  return (
    <TransientToast
      identity={`${message}:${error}`}
      persistent={Boolean(error)}
      onDismiss={dismiss}
    >
      <p role={error ? 'alert' : 'status'}>{error ?? message}</p>
      <div className="button-row">
        {canUndo && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void undo()}
          >
            Desfazer
          </button>
        )}
        <button
          className="icon-button"
          aria-label="Fechar aviso de tarefas"
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </TransientToast>
  )
}
