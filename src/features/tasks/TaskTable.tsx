import { SelectMenu } from '../../components/SelectMenu'
import { useState } from 'react'
import { Check, Circle, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import type { TaskListProps } from './TaskList'
import type { Task } from '../../data/models'
import {
  formatTaskDate,
  taskPriorityLabels,
  taskStatusLabels,
} from '../../lib/tasks'
import '../../styles/task-table.css'

export function TaskTable({ tasks, busy, onEdit, onStatus }: TaskListProps) {
  const data = useData((s) => s.data),
    [requestedPage, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(tasks.length / 200)),
    page = Math.min(requestedPage, pages - 1)
  return (
    <>
      <p className="task-help" id="task-table-hint">
        Tabela detalhada. Em telas pequenas, role horizontalmente para ver todas
        as colunas.
      </p>
      <div
        className="task-table-scroll"
        role="region"
        aria-label="Tabela de tarefas, com rolagem horizontal"
        aria-describedby="task-table-hint"
        tabIndex={0}
      >
        <table className="task-table">
          <caption className="sr-only">Tarefas e seus contextos</caption>
          <thead>
            <tr>
              {[
                'Concluída',
                'Tarefa',
                'Prazo',
                'Prioridade',
                'Contexto',
                'Situação',
                'Projeto / Meta',
              ].map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.slice(page * 200, (page + 1) * 200).map((task) => {
              const Icon =
                task.status === 'done'
                  ? Check
                  : task.status === 'doing'
                    ? Clock
                    : Circle
              return (
                <tr
                  key={task.id}
                  data-task-id={task.id}
                  data-status={task.status}
                  onClick={(event) => {
                    if (
                      !(event.target as HTMLElement).closest(
                        'button, a, select, input',
                      )
                    )
                      onEdit(task)
                  }}
                >
                  <td>
                    <button
                      role="checkbox"
                      className="task-check"
                      aria-checked={task.status === 'done'}
                      aria-label={`Concluída: ${task.title}`}
                      disabled={busy}
                      onClick={() =>
                        onStatus(task, task.status === 'done' ? 'todo' : 'done')
                      }
                    >
                      {task.status === 'done' ? (
                        <Check aria-hidden="true" />
                      ) : (
                        <Circle aria-hidden="true" />
                      )}
                    </button>
                  </td>
                  <th scope="row">
                    <button
                      className="task-name"
                      aria-label={`Editar ${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      <strong>{task.title}</strong>
                    </button>
                    {task.subtasks.length > 0 && (
                      <span className="task-help">
                        {task.subtasks.filter((s) => s.done).length}/
                        {task.subtasks.length} subtarefas
                      </span>
                    )}
                  </th>
                  <td>
                    {task.dueDate ? formatTaskDate(task.dueDate) : 'Sem prazo'}
                    {task.dueTime && <span> · {task.dueTime}</span>}
                  </td>
                  <td>{taskPriorityLabels[task.priority]}</td>
                  <td>{task.context || 'Sem contexto'}</td>
                  <td>
                    <div className="table-status">
                      <Icon aria-hidden="true" />
                      <SelectMenu
                        className="task-status"
                        label={`Situação de ${task.title}`}
                        value={task.status}
                        disabled={busy}
                        options={Object.entries(taskStatusLabels).map(
                          ([value, label]) => ({ value, label }),
                        )}
                        onChange={(value) =>
                          onStatus(task, value as Task['status'])
                        }
                      />
                    </div>
                  </td>
                  <td>
                    {task.links
                      .filter(
                        (l) => l.type === 'projects' || l.type === 'goals',
                      )
                      .map((link) => {
                        if (link.type !== 'projects' && link.type !== 'goals')
                          return null
                        const item = data[link.type].find(
                          (i) => i.id === link.id,
                        )
                        return item ? (
                          <Link
                            className="table-relation"
                            key={link.id}
                            to={`/metas?${link.type === 'projects' ? 'project' : 'goal'}=${link.id}`}
                          >
                            {item.title}
                          </Link>
                        ) : null
                      })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!tasks.length && (
          <p className="tasks-empty">
            Nenhuma tarefa nesta seleção. Limpe os filtros ou capture um próximo
            passo.
          </p>
        )}
      </div>
      {pages > 1 && (
        <div className="button-row table-pagination">
          <button
            className="button"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            Página anterior
          </button>
          <span role="status">
            Página {page + 1} de {pages}. Até 200 tarefas por página.
          </span>
          <button
            className="button"
            disabled={page === pages - 1}
            onClick={() => setPage(page + 1)}
          >
            Próxima página
          </button>
        </div>
      )}
    </>
  )
}
