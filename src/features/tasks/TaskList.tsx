import { SelectMenu } from '../../components/SelectMenu'
import { Check, Circle, GripVertical, Repeat2, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnimatePresence, m as motion, useIsPresent } from 'framer-motion'
import { useAtlasReducedMotion } from '../../app/use-motion'
import {
  cloneElement,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Task } from '../../data/models'
import {
  formatTaskDate,
  taskPriorityLabels,
  taskStatusLabels,
} from '../../lib/tasks'
import { dateKey } from '../../lib/habits'
import { groupTasksByDate } from '../../lib/task-groups'

export interface TaskListProps {
  tasks: Task[]
  busy: boolean
  onEdit: (task: Task) => void
  onStatus: (task: Task, status: Task['status']) => void
  onPostpone?: (task: Task) => void
  draggable?: boolean
  grouped?: boolean
}
export function TaskList({
  tasks,
  busy,
  onEdit,
  onStatus,
  onPostpone,
  draggable = false,
  grouped = false,
}: TaskListProps) {
  const reduced = useAtlasReducedMotion()
  const today = dateKey(new Date())
  function row(task: Task) {
    const overdue =
      task.status !== 'done' && task.dueDate !== null && task.dueDate < today
    return (
      <div
        className="task-row"
        data-status={task.status}
        data-task-id={task.id}
        draggable={draggable && !busy}
        onDragStart={(event) => {
          if (!draggable || busy) {
            event.preventDefault()
            return
          }
          event.dataTransfer.setData('text/task-id', task.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
      >
        {draggable && <GripVertical className="task-grip" aria-hidden="true" />}
        <motion.button
          className="task-check"
          aria-label={
            task.status === 'done'
              ? `Reabrir ${task.title}`
              : `Concluir ${task.title}`
          }
          aria-pressed={task.status === 'done'}
          disabled={busy}
          whileTap={reduced ? undefined : { scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          onClick={() =>
            onStatus(task, task.status === 'done' ? 'todo' : 'done')
          }
        >
          {task.status === 'done' ? (
            <Check aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          )}
        </motion.button>
        <div className="task-information">
          <button
            className="task-name"
            aria-label={`Editar ${task.title}`}
            aria-describedby={`task-meta-${task.id}`}
            onClick={() => onEdit(task)}
          >
            <strong>{task.title}</strong>
          </button>
          <span className="task-meta" id={`task-meta-${task.id}`}>
            <span data-overdue={overdue}>
              {overdue ? 'Atrasada · ' : ''}
              {task.dueDate ? formatTaskDate(task.dueDate) : 'Sem prazo'}
              {task.dueTime ? ` · ${task.dueTime}` : ''}
            </span>
            <span>
              {taskPriorityLabels[task.priority]}
              {task.context ? ` · ${task.context}` : ''}
            </span>
            {task.subtasks.length > 0 && (
              <span>
                {task.subtasks.filter((item) => item.done).length}/
                {task.subtasks.length} subtarefas
              </span>
            )}
            {task.repeat && (
              <span>
                <Repeat2 aria-hidden="true" /> Repete
              </span>
            )}
            {task.isExample && <span>Exemplo</span>}
            {task.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </span>
        </div>
        <SelectMenu
          className="task-status"
          label={`Situação de ${task.title}`}
          value={task.status}
          disabled={busy}
          options={Object.entries(taskStatusLabels).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => onStatus(task, value as Task['status'])}
        />
        {onPostpone && task.status !== 'done' && (
          <button
            className="button task-postpone"
            disabled={busy}
            aria-label={`Adiar para amanhã: ${task.title}`}
            onClick={() => onPostpone(task)}
          >
            Adiar para amanhã
          </button>
        )}
        <Link
          className="icon-button"
          to={`/foco?task=${encodeURIComponent(task.id)}`}
          aria-label={`Focar em ${task.title}`}
          title="Iniciar foco nesta tarefa"
        >
          <Timer aria-hidden="true" />
        </Link>
      </div>
    )
  }
  if (tasks.length > 200) return <VirtualTasks tasks={tasks} render={row} />
  if (grouped)
    return (
      <div className="task-date-groups">
        {groupTasksByDate(tasks, today).map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="task-group-title">
              {group.title}
              <span className="caption">{group.tasks.length}</span>
            </h2>
            <TaskList
              tasks={group.tasks}
              busy={busy}
              onEdit={onEdit}
              onStatus={onStatus}
              onPostpone={onPostpone}
            />
          </section>
        ))}
      </div>
    )
  return (
    <ul className="task-list" data-testid="task-list">
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <TaskPresence
            key={task.id}
            reduced={reduced}
            layout={!draggable && !reduced && tasks.length <= 30}
          >
            {row(task)}
          </TaskPresence>
        ))}
      </AnimatePresence>
    </ul>
  )
}
function TaskPresence({
  children,
  reduced,
  layout,
}: {
  children: ReactElement<{ 'data-task-id'?: string }>
  reduced: boolean
  layout: boolean
}) {
  const present = useIsPresent()
  return (
    <motion.li
      inert={!present}
      aria-hidden={present ? undefined : true}
      layout={layout ? 'position' : false}
      initial={reduced || !layout ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced || !layout ? undefined : { opacity: 0, y: -4 }}
      transition={{
        duration: reduced ? 0 : 0.18,
        layout: { duration: 0.2, delay: 0.12 },
      }}
    >
      {present
        ? children
        : cloneElement(children, { 'data-task-id': undefined })}
    </motion.li>
  )
}
function VirtualTasks({
  tasks,
  render,
}: {
  tasks: Task[]
  render: (task: Task) => ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const pending = useRef<number | null>(null)
  // React Compiler is not enabled; TanStack owns its measured mutable layout.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 128,
    overscan: 5,
  })
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !(event.target instanceof HTMLElement) ||
      !event.target.classList.contains('task-name')
    )
      return
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const row = event.target.closest<HTMLElement>('[data-task-index]')
    if (!row) return
    event.preventDefault()
    const current = Number(row.dataset.taskIndex)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tasks.length - 1
          : Math.max(
              0,
              Math.min(
                tasks.length - 1,
                current + (event.key === 'ArrowDown' ? 1 : -1),
              ),
            )
    pending.current = next
    virtual.scrollToIndex(next, { align: 'auto' })
    requestAnimationFrame(() => {
      const button = scroller.current?.querySelector<HTMLButtonElement>(
        `[data-task-index="${next}"] .task-name`,
      )
      if (button) {
        button.focus()
        pending.current = null
      }
    })
  }
  return (
    <>
      <p className="task-help">
        Lista longa: no nome da tarefa, use ↑/↓ e Home/End para percorrer.
      </p>
      <div
        ref={scroller}
        className="task-list-scroll"
        onKeyDown={move}
        data-testid="task-list"
      >
        <div
          role="list"
          aria-label="Tarefas"
          className="task-virtual-space"
          style={{ height: virtual.getTotalSize() }}
        >
          {virtual.getVirtualItems().map((item) => (
            <div
              key={tasks[item.index]!.id}
              role="listitem"
              aria-setsize={tasks.length}
              aria-posinset={item.index + 1}
              className="task-virtual-row"
              data-task-index={item.index}
              data-index={item.index}
              style={{ transform: `translateY(${item.start}px)` }}
              ref={(node) => {
                virtual.measureElement(node)
                if (node && pending.current === item.index) {
                  node.querySelector<HTMLButtonElement>('.task-name')?.focus()
                  pending.current = null
                }
              }}
            >
              {render(tasks[item.index]!)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
