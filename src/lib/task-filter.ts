import type { Task } from '../data/models'
export function filterTasks(
  tasks: Task[],
  query: string,
  context: string,
  status: string,
) {
  const needle = query.trim().toLocaleLowerCase('pt-BR')
  return tasks.filter(
    (task) =>
      (context === 'all' ||
        (context === 'none'
          ? !task.context
          : `context:${task.context}` === context)) &&
      (status === 'all' || task.status === status) &&
      (!needle ||
        [task.title, ...task.tags, task.context ?? '']
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(needle)),
  )
}
export function taskCounts(tasks: Task[]) {
  return {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    doing: tasks.filter((t) => t.status === 'doing').length,
    done: tasks.filter((t) => t.status === 'done').length,
  }
}
