import type { Habit, Snapshot } from '../data/models'
import {
  routineConfigSchema,
  type RoutineConfig,
  type RoutineMapping,
} from '../data/routine-models'
import { legacySchedule, withSchedule } from './habit-schedule'

export const routineFileLimit = 1024 * 1024
export function parseRoutineConfig(content: string): RoutineConfig {
  if (new TextEncoder().encode(content).length > routineFileLimit)
    throw new Error('A rotina deve ter até 1 MB.')
  let input: unknown
  try {
    input = JSON.parse(content)
  } catch {
    throw new Error(
      'Arquivo JSON ilegível. Selecione uma configuração de rotina válida.',
    )
  }
  const parsed = routineConfigSchema.safeParse(input)
  if (!parsed.success)
    throw new Error(
      'Rotina inválida. Confira os sete dias, horários e a programação dos hábitos.',
    )
  return parsed.data
}

export function editHabitSchedule(
  previous: Habit | undefined,
  candidate: Habit,
  today: string,
): Habit {
  if (!previous) return candidate
  const past =
    previous.scheduleVersions?.filter((v) => v.effectiveFrom < today) ?? []
  if (
    candidate.scheduleVersions &&
    previous.scheduleVersions &&
    JSON.stringify(
      candidate.scheduleVersions.filter((v) => v.effectiveFrom < today),
    ) !== JSON.stringify(past)
  )
    throw new Error(
      'Versões anteriores da programação são preservadas. Altere apenas a programação a partir de hoje.',
    )
  const changed =
    candidate.target !== previous.target ||
    candidate.unit !== previous.unit ||
    candidate.timesPerWeek !== previous.timesPerWeek ||
    JSON.stringify(candidate.scheduleVersions) !==
      JSON.stringify(previous.scheduleVersions)
  if (!changed) return candidate
  const proposed = candidate.scheduleVersions?.at(-1)
  if (proposed && proposed.effectiveFrom > today)
    throw new Error(
      'A programação deve começar hoje. Não altere versões futuras por este formulário.',
    )
  const schedule =
    proposed?.effectiveFrom === today
      ? proposed.schedule
      : candidate.timesPerWeek !== previous.timesPerWeek
        ? legacySchedule(candidate)
        : (previous.scheduleVersions?.at(-1)?.schedule ??
          legacySchedule(candidate))
  const preserved = {
    ...candidate,
    scheduleVersions: previous.scheduleVersions,
  }
  // Capture the previous unversioned definition before changing target/frequency.
  if (!preserved.scheduleVersions)
    preserved.scheduleVersions = [
      {
        effectiveFrom: '0001-01-01',
        schedule: legacySchedule(previous),
        target: previous.target,
        unit: previous.unit,
      },
    ]
  return withSchedule(preserved, schedule, today)
}

/** Pure plan. The repository validates concurrency and writes this atomically. */
export function applyRoutinePlan(
  data: Snapshot,
  config: RoutineConfig,
  mapping: RoutineMapping[],
  today: string,
  now: string,
  newIds: string[],
): Snapshot {
  if (
    mapping.length !== config.habits.length ||
    new Set(mapping.map((m) => m.key)).size !== mapping.length
  )
    throw new Error('Associe cada hábito da rotina uma única vez.')
  const used = new Set<string>()
  const habits = [...data.habits]
  config.habits.forEach((definition, index) => {
    const choice = mapping.find((m) => m.key === definition.key)
    if (!choice) throw new Error('Falta uma associação de hábito.')
    const old = choice.habitId
      ? data.habits.find((h) => h.id === choice.habitId)
      : undefined
    if (choice.habitId && !old)
      throw new Error('O hábito associado foi removido. Revise a associação.')
    if (
      old &&
      (old.kind !== definition.kind ||
        (old.kind === 'quantity' && old.unit !== definition.unit))
    )
      throw new Error(
        'Tipo ou unidade incompatível. Escolha outro hábito ou crie um novo; os registros atuais serão mantidos.',
      )
    const id = old?.id ?? newIds[index]
    if (!id || used.has(id))
      throw new Error(
        'Dois hábitos da configuração não podem usar o mesmo histórico.',
      )
    used.add(id)
    const candidate: Habit = {
      ...(old ?? {
        id,
        title: definition.title,
        tags: [],
        links: [],
        createdAt: now,
        updatedAt: now,
      }),
      id,
      isExample: false,
      kind: definition.kind,
      target: definition.target,
      unit: definition.unit,
      timesPerWeek: definition.schedule.timesPerWeek,
    }
    if (old)
      candidate.scheduleVersions = old.scheduleVersions ?? [
        {
          effectiveFrom: '0001-01-01',
          schedule: legacySchedule(old),
          target: old.target,
          unit: old.unit,
        },
      ]
    else candidate.scheduleVersions = []
    const saved = withSchedule(candidate, definition.schedule, today)
    saved.updatedAt = old
      ? new Date(
          Math.max(Date.parse(now), Date.parse(old.updatedAt) + 1),
        ).toISOString()
      : now
    if (old) habits[habits.findIndex((h) => h.id === id)] = saved
    else habits.push(saved)
  })
  return {
    ...data,
    habits,
    routine: {
      updatedAt: now,
      versions: [
        ...(data.routine?.versions.filter((v) => v.effectiveFrom < today) ??
          []),
        { effectiveFrom: today, days: config.days },
      ],
    },
  }
}
