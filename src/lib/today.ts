import { addDays, isValid, parseISO, startOfWeek } from 'date-fns'
import type { Goal, Task } from '../data/models'
import { dateKey } from './habits'
import { sortTasks } from './tasks'

function calendarDate(value: string): Date {
  const date = parseISO(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !isValid(date) ||
    date.getFullYear() < 1 ||
    date.getFullYear() > 9999 ||
    dateKey(date) !== value
  ) {
    throw new RangeError('Use uma data válida no formato AAAA-MM-DD.')
  }
  return date
}

function checkedDateKey(date: Date): string {
  if (!isValid(date) || date.getFullYear() < 1 || date.getFullYear() > 9999) {
    throw new RangeError('Esta semana ultrapassa o limite de datas válidas.')
  }
  return dateKey(date)
}

function appointment(task: Task): boolean {
  return task.tags.some(
    (tag) => tag.normalize('NFC').toLocaleLowerCase('pt-BR') === 'compromisso',
  )
}

function validateTaskDates(tasks: Task[]): void {
  for (const task of tasks) {
    if (task.dueDate !== null) calendarDate(task.dueDate)
  }
}

/** Completed tasks stay visible today so the same action can reopen them. */
export function selectToday(
  tasks: Task[],
  today: string,
  currentTime = '00:00',
): { tasks: Task[]; overdue: Task[] } {
  calendarDate(today)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(currentTime)) {
    throw new RangeError('Use um horário válido no formato HH:MM.')
  }
  validateTaskDates(tasks)
  return {
    tasks: sortTasks(
      tasks.filter(
        (task) =>
          task.dueDate === today &&
          (!appointment(task) || task.dueTime === null),
      ),
    ),
    overdue: sortTasks(
      tasks.filter(
        (task) =>
          task.status !== 'done' &&
          task.dueDate !== null &&
          (task.dueDate < today ||
            (task.dueDate === today &&
              appointment(task) &&
              task.dueTime !== null &&
              task.dueTime < currentTime)),
      ),
    ),
  }
}

/** Manual appointment inputs have minute precision; the current minute is valid. */
export function nextAppointment(tasks: Task[], now: Date): Task | undefined {
  if (!isValid(now)) throw new RangeError('Use uma data de referência válida.')
  const currentMinute = new Date(now)
  currentMinute.setSeconds(0, 0)
  validateTaskDates(tasks)
  const candidates = tasks.flatMap((task) => {
    if (
      !appointment(task) ||
      task.status === 'done' ||
      task.dueDate === null ||
      task.dueTime === null
    )
      return []
    if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(task.dueTime)) {
      throw new RangeError('Use um horário válido no formato HH:MM.')
    }
    const date = parseISO(`${task.dueDate}T${task.dueTime}`)
    if (!isValid(date))
      throw new RangeError('Use uma data de compromisso válida.')
    return date >= currentMinute ? [{ task, time: date.getTime() }] : []
  })
  candidates.sort(
    (left, right) =>
      left.time - right.time || left.task.id.localeCompare(right.task.id),
  )
  return candidates[0]?.task
}

/** Weeks always run Monday through Sunday, including year boundaries. */
export function weekEnd(today: string): string {
  const start = startOfWeek(calendarDate(today), { weekStartsOn: 1 })
  return checkedDateKey(addDays(start, 6))
}

export function weeklyGoal(goals: Goal[], today: string): Goal | undefined {
  const start = checkedDateKey(
    startOfWeek(calendarDate(today), { weekStartsOn: 1 }),
  )
  const end = weekEnd(today)
  for (const goal of goals) {
    if (goal.deadline !== null) calendarDate(goal.deadline)
  }
  const dated = goals.find(
    (goal) =>
      goal.deadline !== null && goal.deadline >= start && goal.deadline <= end,
  )
  if (dated) return dated
  return goals.find((goal) => {
    if (goal.deadline !== null) return false
    const created = parseISO(goal.createdAt)
    if (!isValid(created))
      throw new RangeError('Use uma data de criação válida.')
    const day = checkedDateKey(created)
    return day >= start && day <= end
  })
}

/** Both link directions count; one task ID contributes only once. */
export function goalTaskProgress(
  goal: Goal,
  tasks: Task[],
): { completed: number; total: number; percent: number } {
  const linkedIds = new Set(
    goal.links.filter((link) => link.type === 'tasks').map((link) => link.id),
  )
  const linked = new Map<string, Task>()
  for (const task of tasks) {
    if (
      linkedIds.has(task.id) ||
      task.links.some((link) => link.type === 'goals' && link.id === goal.id)
    ) {
      if (!linked.has(task.id)) linked.set(task.id, task)
    }
  }
  const total = linked.size
  const completed = [...linked.values()].filter(
    (task) => task.status === 'done',
  ).length
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}
