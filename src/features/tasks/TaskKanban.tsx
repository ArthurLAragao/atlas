import { useState, type DragEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Task } from '../../data/models'
import { taskStatusLabels } from '../../lib/tasks'
import { TaskList } from './TaskList'
import '../../styles/task-views.css'

interface TaskKanbanProps {
  tasks: Task[]
  busy: boolean
  onEdit: (task: Task) => void
  onStatus: (task: Task, status: Task['status']) => void
  onNew?: (status: Task['status']) => void
}

const statuses: Task['status'][] = ['todo', 'doing', 'done']
const taskDragType = 'text/task-id'

export function TaskKanban({
  tasks,
  busy,
  onEdit,
  onStatus,
  onNew,
}: TaskKanbanProps) {
  const [destination, setDestination] = useState<Task['status'] | null>(null)

  function accepts(event: DragEvent<HTMLElement>) {
    return !busy && event.dataTransfer.types.includes(taskDragType)
  }

  function enter(event: DragEvent<HTMLElement>, status: Task['status']) {
    if (!accepts(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDestination(status)
  }

  function drop(event: DragEvent<HTMLElement>, status: Task['status']) {
    setDestination(null)
    if (!accepts(event)) return
    event.preventDefault()
    const task = tasks.find(
      (item) => item.id === event.dataTransfer.getData(taskDragType),
    )
    if (task && task.status !== status) onStatus(task, status)
  }

  return (
    <div className="task-kanban-view">
      <p className="task-view-help" id="task-kanban-help">
        Arraste uma tarefa entre colunas ou use o campo Situação de cada tarefa.
      </p>
      <div
        className="task-board"
        role="region"
        tabIndex={0}
        aria-label="Quadro Kanban com rolagem horizontal"
        aria-describedby="task-kanban-help"
        onDragEnd={() => setDestination(null)}
      >
        {statuses.map((status) => {
          const column = tasks.filter((task) => task.status === status)
          return (
            <section
              className="task-column"
              key={status}
              aria-labelledby={`task-column-${status}`}
              data-drop-status={status}
              data-drop-active={destination === status}
              onDragEnter={(event) => enter(event, status)}
              onDragOver={(event) => enter(event, status)}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setDestination(null)
              }}
              onDrop={(event) => drop(event, status)}
            >
              <header className="task-column-heading">
                <h2 id={`task-column-${status}`}>{taskStatusLabels[status]}</h2>
                <span className="caption">
                  {column.length} {column.length === 1 ? 'tarefa' : 'tarefas'}
                </span>
                {onNew && (
                  <button
                    className="icon-button"
                    aria-label={`Adicionar em ${taskStatusLabels[status]}`}
                    disabled={busy}
                    onClick={() => onNew(status)}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                )}
              </header>
              {destination === status && (
                <p className="task-drop-hint" role="status">
                  Solte para mover para {taskStatusLabels[status]}.
                </p>
              )}
              {column.length ? (
                <TaskList
                  tasks={column}
                  busy={busy}
                  onEdit={onEdit}
                  onStatus={onStatus}
                  draggable
                />
              ) : (
                <p className="task-column-empty">
                  {status === 'todo'
                    ? 'Crie uma tarefa ou mova uma para cá.'
                    : status === 'doing'
                      ? 'Escolha uma tarefa e mude para Fazendo.'
                      : 'As tarefas concluídas aparecem aqui.'}
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
