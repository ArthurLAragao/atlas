import { addDays, parseISO } from 'date-fns'
import type { Habit } from '../data/models'
import type {
  HabitSchedule,
  ScheduleVersion,
  WeeklyRoutine,
} from '../data/routine-models'

export function legacySchedule(habit: Habit): HabitSchedule {
  return {
    mode: habit.timesPerWeek === 7 ? 'daily' : 'flexible',
    timesPerWeek: habit.timesPerWeek,
    days: [],
  }
}
export function scheduleVersion(
  habit: Habit,
  date: string,
): ScheduleVersion | null {
  if (!habit.scheduleVersions)
    return {
      effectiveFrom: '0001-01-01',
      schedule: legacySchedule(habit),
      target: habit.target,
      unit: habit.unit,
    }
  return habit.scheduleVersions.findLast((v) => v.effectiveFrom <= date) ?? null
}
export function scheduledDay(habit: Habit, date: string) {
  const version = scheduleVersion(habit, date)
  const day = version?.schedule.days.find(
    (d) => d.weekday === parseISO(date).getDay(),
  )
  const scheduled = Boolean(
    version && (version.schedule.mode !== 'weekdays' || day),
  )
  return {
    scheduled,
    optional: day?.optional ?? false,
    label: day?.label ?? habit.title,
    time: day?.time ?? null,
    dayOffset: day?.dayOffset ?? 0,
    order: day?.order ?? 0,
    target: version?.target ?? habit.target,
    unit: version?.unit ?? habit.unit,
    mode: version?.schedule.mode ?? 'daily',
  }
}
export function scheduledHabits(
  habits: Habit[],
  date: string,
  optional = false,
) {
  return habits
    .filter((h) => {
      const d = scheduledDay(h, date)
      return d.scheduled && d.optional === optional
    })
    .sort((a, b) => {
      const x = scheduledDay(a, date),
        y = scheduledDay(b, date)
      const minutes = (d: typeof x) =>
        d.time
          ? d.dayOffset * 1440 +
            Number(d.time.slice(0, 2)) * 60 +
            Number(d.time.slice(3))
          : 12 * 60
      return (
        minutes(x) - minutes(y) || x.order - y.order || a.id.localeCompare(b.id)
      )
    })
}
/** Replace today's not-yet-past version; earlier dates are immutable. */
export function withSchedule(
  habit: Habit,
  schedule: HabitSchedule,
  effectiveFrom: string,
): Habit {
  const history = habit.scheduleVersions ?? [
    {
      effectiveFrom: '0001-01-01',
      schedule: legacySchedule(habit),
      target: habit.target,
      unit: habit.unit,
    },
  ]
  return {
    ...habit,
    timesPerWeek: schedule.timesPerWeek,
    scheduleVersions: [
      ...history.filter((v) => v.effectiveFrom < effectiveFrom),
      { effectiveFrom, schedule, target: habit.target, unit: habit.unit },
    ],
  }
}
export function routineDay(
  routine: WeeklyRoutine | null | undefined,
  date: string,
) {
  return routine?.versions
    .findLast((v) => v.effectiveFrom <= date)
    ?.days.find((d) => d.weekday === parseISO(date).getDay())
}
export function previousNight(habits: Habit[], today: string) {
  const date = addDays(parseISO(today), -1)
  const yesterday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return {
    date: yesterday,
    habits: habits.filter((h) => {
      const d = scheduledDay(h, yesterday)
      return d.scheduled && d.dayOffset === 1
    }),
  }
}
export function plannedTime(day: ReturnType<typeof scheduledDay>) {
  return day.time
    ? `${day.time}${day.dayOffset ? ' · dia seguinte' : ''}`
    : 'Ao longo do dia'
}
