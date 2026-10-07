import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Task } from '../data/models'
import { dateKey } from './habits'

export const taskStatusLabels: Record<Task['status'], string> = {
  todo: 'A fazer',
  doing: 'Fazendo',
  done: 'Feito',
}
export const taskPriorityLabels: Record<Task['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

function calendarDate(value: string): Date {
  const date = parseISO(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !isValid(date) ||
    dateKey(date) !== value
  )
    throw new RangeError('Use uma data válida no formato AAAA-MM-DD.')
  return date
}

function occurrenceKey(date: Date): string {
  if (!isValid(date) || date.getFullYear() < 1 || date.getFullYear() > 9999)
    throw new RangeError(
      'A próxima ocorrência ultrapassa o limite de datas. Reduza o intervalo de repetição.',
    )
  return dateKey(date)
}

/**
 * Completing one occurrence creates one future occurrence. Missed dates are
 * skipped with arithmetic, never an unbounded loop. Month candidates advance
 * from the original due date so skipping February does not drift into March.
 */
export function nextOccurrence(
  task: Task,
  completionDate: string,
): string | null {
  if (!task.repeat) return null
  const completion = calendarDate(completionDate)
  const anchor = calendarDate(task.dueDate ?? completionDate)
  const { unit, interval } = task.repeat
  if (!Number.isInteger(interval) || interval < 1 || interval > 365)
    throw new RangeError('Use um intervalo de repetição entre 1 e 365.')

  if (unit === 'month') {
    let count = Math.max(
      1,
      Math.floor(differenceInCalendarMonths(completion, anchor) / interval),
    )
    let candidate = addMonths(anchor, count * interval)
    if (candidate <= completion) {
      count += 1
      candidate = addMonths(anchor, count * interval)
    }
    return occurrenceKey(candidate)
  }

  const step = interval * (unit === 'week' ? 7 : 1)
  const count = Math.max(
    1,
    Math.floor(differenceInCalendarDays(completion, anchor) / step) + 1,
  )
  return occurrenceKey(addDays(anchor, count * step))
}

/** Always six Monday–Sunday weeks, including adjacent month days. */
export function calendarDays(
  month: Date,
): { date: string; inMonth: boolean }[] {
  if (!isValid(month)) throw new RangeError('Use um mês válido.')
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, index) => {
    const day = addDays(first, index)
    return {
      date: dateKey(day),
      inMonth:
        day.getMonth() === month.getMonth() &&
        day.getFullYear() === month.getFullYear(),
    }
  })
}

export function formatTaskDate(date: string): string {
  return format(calendarDate(date), "d 'de' MMM 'de' yyyy", { locale: ptBR })
}

const priorityOrder: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/** Stable, deterministic order without mutating the caller's collection. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    const completed =
      Number(left.status === 'done') - Number(right.status === 'done')
    if (completed) return completed
    if (left.dueDate !== right.dueDate) {
      if (left.dueDate === null) return 1
      if (right.dueDate === null) return -1
      return left.dueDate.localeCompare(right.dueDate)
    }
    const priority =
      priorityOrder[left.priority] - priorityOrder[right.priority]
    if (priority) return priority
    return (
      left.title.localeCompare(right.title, 'pt-BR') ||
      left.id.localeCompare(right.id)
    )
  })
}
