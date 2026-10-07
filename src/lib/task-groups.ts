import type { Task } from '../data/models'

export function groupTasksByDate(
  tasks: Task[],
  today: string,
): { title: string; tasks: Task[] }[] {
  const groups = [
    { title: 'Atrasadas', tasks: [] as Task[] },
    { title: 'Hoje', tasks: [] as Task[] },
    { title: 'Próximas', tasks: [] as Task[] },
    { title: 'Sem prazo', tasks: [] as Task[] },
    { title: 'Concluídas', tasks: [] as Task[] },
  ]
  for (const task of tasks) {
    const index =
      task.status === 'done'
        ? 4
        : !task.dueDate
          ? 3
          : task.dueDate < today
            ? 0
            : task.dueDate === today
              ? 1
              : 2
    groups[index]!.tasks.push(task)
  }
  return groups.filter((group) => group.tasks.length > 0)
}
