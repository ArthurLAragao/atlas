import { addDays, parseISO } from 'date-fns'
import type { Snapshot } from '../data/models'
import type { ActivityEvent } from '../data/profile-models'
import { dateKey, generateHeatmap } from './habits'

/** One action per source (habit/review per calendar day); independent of XP. */
export function deduplicateActivity(events: ActivityEvent[]): ActivityEvent[] {
  const byKey = new Map<string, ActivityEvent>()
  for (const event of events) {
    const previous = byKey.get(event.key)
    if (!previous || event.at > previous.at) byKey.set(event.key, event)
  }
  return [...byKey.values()].sort(
    (a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key),
  )
}
export function activityEvents(data: Snapshot): ActivityEvent[] {
  const derived: ActivityEvent[] = []
  for (const log of data.habitLogs) {
    if (log.isExample || log.rest || log.value <= 0) continue
    const habit = data.habits.find((item) => item.id === log.habitId)
    derived.push({
      key: `habit:${log.habitId}:${log.date}`,
      kind: 'habit',
      sourceId: log.habitId,
      title: habit?.title ?? 'Hábito removido',
      date: log.date,
      at: log.updatedAt,
      value: log.value,
    })
  }
  for (const session of data.focusSessions) {
    if (
      session.isExample ||
      session.mode !== 'focus' ||
      !session.endedAt ||
      session.elapsedMs <= 0
    )
      continue
    const date = dateKey(parseISO(session.endedAt))
    derived.push({
      key: `focus:${session.id}`,
      kind: 'focus',
      sourceId: session.id,
      title: session.title,
      date,
      at: session.endedAt,
      value: session.elapsedMs / 60000,
    })
  }
  for (const card of data.flashcards) {
    if (card.isExample || !card.review.lastReviewedAt) continue
    const at = card.review.lastReviewedAt,
      date = dateKey(parseISO(at))
    derived.push({
      key: `flashcard:${card.id}:${date}`,
      kind: 'flashcard',
      sourceId: card.id,
      title: card.question.slice(0, 240),
      date,
      at,
      value: 1,
    })
  }
  return deduplicateActivity([...derived, ...data.activity])
}
export function activityIntensity(points: number): 0 | 1 | 2 | 3 | 4 {
  return points <= 0
    ? 0
    : points === 1
      ? 1
      : points <= 3
        ? 2
        : points <= 6
          ? 3
          : 4
}
export function activityDays(events: ActivityEvent[], today: string) {
  const days = new Map<
    string,
    {
      date: string
      points: number
      types: Partial<Record<ActivityEvent['kind'], number>>
    }
  >()
  for (const event of deduplicateActivity(events)) {
    if (event.date > today) continue
    const day = days.get(event.date) ?? {
      date: event.date,
      points: 0,
      types: {},
    }
    day.points++
    day.types[event.kind] = (day.types[event.kind] ?? 0) + 1
    days.set(event.date, day)
  }
  return days
}
export function activityStreaks(events: ActivityEvent[], today: string) {
  const dates = [...activityDays(events, today).keys()].sort()
  let best = 0,
    run = 0,
    previous = ''
  for (const date of dates) {
    run =
      previous && dateKey(addDays(parseISO(previous), 1)) === date ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }
  const yesterday = dateKey(addDays(parseISO(today), -1))
  return {
    current: previous === today || previous === yesterday ? run : 0,
    best,
  }
}
export function activityGrid(
  events: ActivityEvent[],
  today: string,
  weeks: number,
) {
  const days = activityDays(events, today)
  return generateHeatmap(today, weeks).map((week) =>
    week.map((day) => ({
      ...day,
      ...(days.get(day.date) ?? { points: 0, types: {} }),
      level: activityIntensity(days.get(day.date)?.points ?? 0),
    })),
  )
}
export function activityMetrics(data: Snapshot, today: string) {
  const events = activityEvents(data),
    streak = activityStreaks(events, today)
  const tasks = new Set([
    ...data.tasks
      .filter((t) => t.status === 'done' && !t.isExample)
      .map((t) => t.id),
    ...events.filter((e) => e.kind === 'task').map((e) => e.sourceId),
  ])
  return {
    ...streak,
    tasks: tasks.size,
    focusMinutes: events
      .filter((e) => e.kind === 'focus')
      .reduce((sum, e) => sum + e.value, 0),
    habits: events.filter((e) => e.kind === 'habit').length,
  }
}
export const activityLabels = {
  task: 'Tarefas',
  habit: 'Hábitos',
  focus: 'Foco',
  flashcard: 'Flashcards',
  step: 'Etapas',
}
export function activityHref(
  event: ActivityEvent,
  data: Snapshot,
): string | null {
  if (event.kind === 'task' && data.tasks.some((t) => t.id === event.sourceId))
    return `/tarefas?task=${event.sourceId}`
  if (
    event.kind === 'habit' &&
    data.habits.some((h) => h.id === event.sourceId)
  )
    return '/habitos'
  if (event.kind === 'focus') return '/foco'
  if (event.kind === 'flashcard') return '/estudos'
  if (event.kind === 'step') {
    const path = data.studyPaths.find((p) =>
      p.steps.some((s) => s.id === event.sourceId),
    )
    return path ? `/estudos?path=${path.id}` : null
  }
  return null
}
