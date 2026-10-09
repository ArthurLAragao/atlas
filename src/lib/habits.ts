import {
  addDays,
  addWeeks,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Habit, HabitLog } from '../data/models'
import { scheduledDay, scheduleVersion } from './habit-schedule'

export type Intensity = 0 | 1 | 2 | 3 | 4

/** Date-only values use the local calendar, never a UTC conversion. */
export function dateKey(date: Date): string {
  if (!isValid(date)) throw new RangeError('Use uma data válida.')
  return format(date, 'yyyy-MM-dd')
}

function calendarDate(value: string): Date {
  const date = parseISO(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !isValid(date) ||
    dateKey(date) !== value
  ) {
    throw new RangeError('Use uma data válida no formato AAAA-MM-DD.')
  }
  return date
}

export function formatDay(date: string): string {
  return format(calendarDate(date), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  })
}

function dayResult(habit: Habit, log: HabitLog | undefined, date?: string) {
  const target = date ? scheduledDay(habit, date).target : habit.target
  const value = log?.value ?? 0
  const rest = log?.rest ?? false
  return {
    value,
    rest,
    completed: !rest && value >= target,
    ratio: rest ? 0 : value / target,
  }
}

export function habitDay(habit: Habit, logs: HabitLog[], date: string) {
  return dayResult(
    habit,
    logs.find((log) => log.habitId === habit.id && log.date === date),
    date,
  )
}

function logIndex(habit: Habit, logs: HabitLog[], today: string) {
  return new Map(
    logs
      .filter((log) => log.habitId === habit.id && log.date <= today)
      .map((log) => [log.date, log] as const),
  )
}

function progressForWeek(
  habit: Habit,
  index: Map<string, HabitLog>,
  start: Date,
  reference = dateKey(addDays(start, 6)),
) {
  let completed = 0
  let rest = 0
  let scheduled = 0
  const goal = scheduleVersion(habit, reference)?.schedule
  for (let day = 0; day < 7; day += 1) {
    const key = dateKey(addDays(start, day))
    const plan = scheduledDay(habit, key)
    if (!plan.scheduled || plan.optional) continue
    if ((plan.mode === 'flexible') !== (goal?.mode === 'flexible')) continue
    scheduled++
    const entry = dayResult(habit, index.get(key), key)
    if (entry.completed) completed += 1
    if (entry.rest) rest += 1
  }
  return {
    completed,
    required: Math.min(
      goal?.mode === 'flexible' ? goal.timesPerWeek : scheduled,
      scheduled - rest,
    ),
  }
}

/** Monday–Sunday; future logs cannot satisfy a current week's goal. */
export function weekProgress(habit: Habit, logs: HabitLog[], today: string) {
  return progressForWeek(
    habit,
    logIndex(habit, logs, today),
    startOfWeek(calendarDate(today), { weekStartsOn: 1 }),
    today,
  )
}

/**
 * Daily goals count completed days; flexible goals count fulfilled weeks.
 * Rest preserves a sequence without incrementing it. An unfinished current
 * day/week has a grace period; only a missing past period breaks a sequence.
 * History starts at the first log and never includes dates after today.
 */
export function getStreaks(habit: Habit, logs: HabitLog[], today: string) {
  const end = calendarDate(today)
  const index = logIndex(habit, logs, today)
  const first = [...index.keys()].sort()[0]
  const unit =
    scheduledDay(habit, today).mode === 'flexible'
      ? ('semanas' as const)
      : scheduledDay(habit, today).mode === 'weekdays'
        ? ('ocorrências' as const)
        : ('dias' as const)
  if (!first) return { current: 0, best: 0, unit }

  let current = 0
  let best = 0
  if (unit !== 'semanas') {
    for (let date = calendarDate(first); date <= end; date = addDays(date, 1)) {
      const key = dateKey(date)
      const plan = scheduledDay(habit, key)
      if (plan.mode === 'flexible') {
        current = 0
        continue
      }
      if (!plan.scheduled || plan.optional) continue
      const entry = dayResult(habit, index.get(key), key)
      if (entry.completed) current += 1
      else if (!entry.rest && key !== today) current = 0
      best = Math.max(best, current)
    }
  } else {
    const currentWeek = startOfWeek(end, { weekStartsOn: 1 })
    for (
      let date = startOfWeek(calendarDate(first), { weekStartsOn: 1 });
      date <= currentWeek;
      date = addWeeks(date, 1)
    ) {
      const reference = date < currentWeek ? dateKey(addDays(date, 6)) : today
      if (scheduledDay(habit, reference).mode !== 'flexible') {
        current = 0
        continue
      }
      const { completed, required } = progressForWeek(
        habit,
        index,
        date,
        reference,
      )
      if (required > 0 && completed >= required) current += 1
      else if (required > 0 && date < currentWeek) current = 0
      best = Math.max(best, current)
    }
  }
  return { current, best, unit }
}

/** Columns are weeks, rows are Monday–Sunday, ending in the current week. */
export function generateHeatmap(today: string, weeks: number) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 53) {
    throw new RangeError('Escolha um período de 1 a 53 semanas.')
  }
  const start = addWeeks(
    startOfWeek(calendarDate(today), { weekStartsOn: 1 }),
    1 - weeks,
  )
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = dateKey(addDays(start, week * 7 + day))
      return { date, future: date > today }
    }),
  )
}

/** Empty, up to 25%, up to 50%, below target, and target reached. */
export function intensity(ratio: number): Intensity {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  if (ratio >= 1) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

/** Average per-habit progress: liters and minutes are never added together. */
export function aggregateDay(habits: Habit[], logs: HabitLog[], date: string) {
  let completed = 0
  let rest = 0
  let progress = 0
  for (const habit of habits) {
    const plan = scheduledDay(habit, date)
    if (!plan.scheduled || plan.optional) continue
    const entry = habitDay(habit, logs, date)
    if (entry.rest) rest += 1
    else progress += Math.min(entry.ratio, 1)
    if (entry.completed) completed += 1
  }
  const total = habits.filter((habit) => {
    const plan = scheduledDay(habit, date)
    return plan.scheduled && !plan.optional
  }).length
  const active = total - rest
  return {
    ratio: active > 0 ? progress / active : 0,
    completed,
    total,
    rest,
  }
}
