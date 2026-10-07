import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import type { EntityMap, Goal, Project, Snapshot } from '../data/models'

export type GoalStatus = NonNullable<Goal['status']>
export type ProjectStatus = NonNullable<Project['status']>
export type DirectionType = 'tasks' | 'notes' | 'goals' | 'projects'

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: 'Ativa',
  completed: 'Concluída',
  archived: 'Arquivada',
}

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: 'Planejado',
  active: 'Em andamento',
  paused: 'Pausado',
  completed: 'Concluído',
  archived: 'Arquivado',
}

export function goalStatus(goal: Goal): GoalStatus {
  return goal.status ?? 'active'
}

export function projectStatus(project: Project): ProjectStatus {
  return project.status ?? 'planned'
}

function keyResultRatio(result: Goal['keyResults'][number]): number {
  if (
    !Number.isFinite(result.current) ||
    result.current < 0 ||
    !Number.isFinite(result.target) ||
    result.target <= 0
  ) {
    throw new RangeError(
      'Use um valor atual não negativo e um alvo maior que zero, ambos finitos.',
    )
  }
  if (result.current === 0) return 0
  // Compare before dividing so valid, very large values cannot overflow.
  return result.current >= result.target ? 1 : result.current / result.target
}

function roundedPercent(ratio: number): number {
  // Correct binary rounding at decimal half boundaries such as 9.95 / 10.
  return Math.round((ratio + Number.EPSILON) * 100)
}

export function keyResultProgress(result: Goal['keyResults'][number]): number {
  return roundedPercent(keyResultRatio(result))
}

/** Manual results are independent of linked tasks and the explicit goal state. */
export function goalProgress(goal: Goal): {
  percent: number
  completed: number
  total: number
} {
  const total = goal.keyResults.length
  let sum = 0
  let completed = 0
  for (const result of goal.keyResults) {
    sum += keyResultRatio(result)
    if (result.current >= result.target) completed += 1
  }
  return {
    percent: total ? roundedPercent(sum / total) : 0,
    completed,
    total,
  }
}

function calendarDate(value: string): Date {
  const parsed = parseISO(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    !isValid(parsed) ||
    parsed.getFullYear() < 1 ||
    parsed.getFullYear() > 9999 ||
    format(parsed, 'yyyy-MM-dd') !== value
  ) {
    throw new RangeError('Use uma data válida no formato AAAA-MM-DD.')
  }
  return parsed
}

/** Calendar days remain stable across daylight-saving changes, without UTC parsing. */
export function daysRemaining(deadline: string, today: string): number {
  return differenceInCalendarDays(calendarDate(deadline), calendarDate(today))
}

export type GoalDeadlineState =
  'none' | 'upcoming' | 'today' | 'overdue' | 'completed' | 'archived'

export function goalDeadline(
  goal: Goal,
  today: string,
): { state: GoalDeadlineState; days: number | null; label: string } {
  calendarDate(today)
  const days =
    goal.deadline === null ? null : daysRemaining(goal.deadline, today)
  const status = goalStatus(goal)
  if (status === 'completed') {
    return { state: 'completed', days, label: 'Meta concluída' }
  }
  if (status === 'archived') {
    return { state: 'archived', days, label: 'Meta arquivada' }
  }
  if (days === null) return { state: 'none', days, label: 'Sem prazo' }
  if (days === 0) return { state: 'today', days, label: 'Prazo hoje' }
  if (days < 0) {
    const elapsed = Math.abs(days)
    return {
      state: 'overdue',
      days,
      label: `Vencida há ${elapsed} ${elapsed === 1 ? 'dia' : 'dias'}`,
    }
  }
  return {
    state: 'upcoming',
    days,
    label: days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`,
  }
}

/** Never infer a weekly intention from dates or examples. Imported ties use the ID. */
export function selectedWeeklyGoal(goals: Goal[]): Goal | undefined {
  return goals
    .filter((goal) => goal.weekly === true && goalStatus(goal) !== 'archived')
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    )[0]
}

/** Relations are typed IDs in either direction; each existing target contributes once. */
export function relatedRecords<K extends DirectionType>(
  data: Snapshot,
  sourceType: 'goals' | 'projects',
  sourceId: string,
  targetType: K,
): EntityMap[K][] {
  const source = data[sourceType].find((item) => item.id === sourceId)
  if (!source) return []
  const direct = new Set(
    source.links
      .filter((link) => link.type === targetType)
      .map((link) => link.id),
  )
  const seen = new Set<string>()
  return (data[targetType] as EntityMap[K][]).filter((item) => {
    if (
      (sourceType === targetType && item.id === sourceId) ||
      seen.has(item.id)
    ) {
      return false
    }
    const linked =
      direct.has(item.id) ||
      item.links.some(
        (link) => link.type === sourceType && link.id === sourceId,
      )
    if (linked) seen.add(item.id)
    return linked
  })
}

export function directionHref(type: DirectionType, id: string): string {
  const encoded = encodeURIComponent(id)
  switch (type) {
    case 'tasks':
      return `/tarefas?task=${encoded}`
    case 'notes':
      return `/notas?note=${encoded}`
    case 'goals':
      return `/metas?goal=${encoded}`
    case 'projects':
      return `/metas?project=${encoded}`
  }
}
