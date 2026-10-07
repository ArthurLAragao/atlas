import { format, isValid } from 'date-fns'
import type { StudyPath, Subject } from '../data/models'
import { daysRemaining } from './goals'

type Assessment = Subject['assessments'][number]
type StudyEvent = Subject['events'][number]
type StudyStep = StudyPath['steps'][number]

export const subjectStatusLabels: Record<Subject['status'], string> = {
  active: 'Ativa',
  completed: 'Concluída',
  archived: 'Arquivada',
}

export const pathStatusLabels: Record<StudyPath['status'], string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  archived: 'Arquivada',
}

function validAssessment(item: Assessment): void {
  if (
    !Number.isFinite(item.score) ||
    !Number.isFinite(item.maxScore) ||
    item.maxScore <= 0 ||
    item.score < 0 ||
    item.score > item.maxScore ||
    (item.weight !== null &&
      (!Number.isFinite(item.weight) || item.weight <= 0))
  ) {
    throw new RangeError(
      'Use uma nota entre zero e a nota máxima, com máximo e peso maiores que zero.',
    )
  }
}

/**
 * All grades are normalized to 0–10 before averaging, irrespective of maxScore.
 * With mixed weights, an omitted weight is 1. The label makes this rule visible.
 * Dividing weights by their maximum prevents overflow with finite large inputs.
 */
export function assessmentAverage(assessments: readonly Assessment[]): {
  value: number | null
  method: 'simple' | 'weighted'
  label: string
} {
  for (const item of assessments) validAssessment(item)
  const weighted = assessments.some((item) => item.weight !== null)
  const method = weighted ? 'weighted' : 'simple'
  const mixed = weighted && assessments.some((item) => item.weight === null)
  const label = weighted
    ? `Média ponderada · escala de 0 a 10${mixed ? ' · peso não informado = 1' : ''}`
    : 'Média simples · escala de 0 a 10'
  if (!assessments.length) return { value: null, method, label }
  const largestWeight = weighted
    ? assessments.reduce(
        (largest, item) => Math.max(largest, item.weight ?? 1),
        0,
      )
    : 1
  let sum = 0
  let totalWeight = 0
  for (const item of assessments) {
    const weight = weighted ? (item.weight ?? 1) / largestWeight : 1
    sum += (item.score / item.maxScore) * weight
    totalWeight += weight
  }
  const value = Math.round((sum / totalWeight) * 1_000) / 100
  return { value, method, label }
}

function validCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Use um número inteiro não negativo para ${field}.`)
  }
}

/** Attendance is an estimate based on classes actually held, never on hour load. */
export function attendance(
  subject: Pick<Subject, 'absences' | 'absenceLimit' | 'classesHeld'>,
): {
  percentage: number | null
  remaining: number | null
  overLimit: boolean
  label: string
} {
  validCount(subject.absences, 'faltas')
  if (subject.absenceLimit !== null)
    validCount(subject.absenceLimit, 'limite de faltas')
  if (subject.classesHeld !== null)
    validCount(subject.classesHeld, 'aulas realizadas')
  const inconsistent =
    subject.classesHeld !== null && subject.absences > subject.classesHeld
  const percentage =
    subject.classesHeld && !inconsistent
      ? Math.round(
          ((subject.classesHeld - subject.absences) / subject.classesHeld) *
            100,
        )
      : null
  const remaining =
    subject.absenceLimit === null
      ? null
      : Math.max(0, subject.absenceLimit - subject.absences)
  const overLimit =
    subject.absenceLimit !== null && subject.absences > subject.absenceLimit
  return {
    percentage,
    remaining,
    overLimit,
    label: inconsistent
      ? 'Revise as aulas realizadas: há mais faltas que aulas informadas.'
      : percentage === null
        ? 'Informe as aulas realizadas para estimar a presença.'
        : `Presença estimada: ${percentage}% das aulas realizadas.`,
  }
}

function referenceDay(now: Date | string): string {
  if (typeof now === 'string') {
    daysRemaining(now, now)
    return now
  }
  if (!isValid(now) || now.getFullYear() < 1 || now.getFullYear() > 9999) {
    throw new RangeError('Use uma data de referência válida.')
  }
  return format(now, 'yyyy-MM-dd')
}

/** Calendar-day comparisons are local and remain stable at DST transitions. */
export function eventCountdown(
  event: Pick<StudyEvent, 'date' | 'status'>,
  now: Date | string,
): {
  days: number
  state: 'future' | 'today' | 'overdue' | 'completed'
  label: string
} {
  const days = daysRemaining(event.date, referenceDay(now))
  if (event.status === 'completed')
    return { days, state: 'completed', label: 'Concluída' }
  if (days === 0) return { days, state: 'today', label: 'Hoje' }
  if (days < 0) {
    const elapsed = Math.abs(days)
    return {
      days,
      state: 'overdue',
      label: `Vencida há ${elapsed} ${elapsed === 1 ? 'dia' : 'dias'}`,
    }
  }
  return {
    days,
    state: 'future',
    label: days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`,
  }
}

/** Only pending events in active subjects are upcoming, including today's events. */
export function nextStudyEvent<
  T extends Pick<Subject, 'id' | 'status' | 'events'>,
>(
  subjects: readonly T[],
  now: Date | string,
): { subject: T; event: StudyEvent } | null {
  const today = referenceDay(now)
  const upcoming = subjects.flatMap((subject) => {
    if (subject.status !== 'active') return []
    return subject.events.flatMap((event) => {
      const countdown = eventCountdown(event, today)
      return event.status === 'pending' && countdown.days >= 0
        ? [{ subject, event }]
        : []
    })
  })
  upcoming.sort(
    (left, right) =>
      left.event.date.localeCompare(right.event.date) ||
      left.subject.id.localeCompare(right.subject.id) ||
      left.event.id.localeCompare(right.event.id),
  )
  return upcoming[0] ?? null
}

/** The first unfinished item is the next small step; manual path status adds no progress. */
export function pathProgress(path: Pick<StudyPath, 'steps'>): {
  done: number
  total: number
  percent: number
  next: StudyStep | null
} {
  const total = path.steps.length
  const done = path.steps.filter((step) => step.done).length
  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    next: path.steps.find((step) => !step.done) ?? null,
  }
}
