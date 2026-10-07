import { deduplicateActivity } from './activity'
import {
  collections,
  snapshotSchema,
  type Entity,
  type Snapshot,
  type Collection,
} from '../data/models'

export function recordCount(data: Snapshot): number {
  return collections.reduce((sum, name) => sum + data[name].length, 0)
}

export function validateSnapshot(input: unknown): Snapshot {
  const parsed = snapshotSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(
      `Dados inválidos em ${first?.path.join('.') || 'arquivo'}. Confira os campos e tente novamente.`,
    )
  }
  const data = parsed.data
  if (
    data.goals.filter((goal) => goal.weekly && goal.status !== 'archived')
      .length > 1
  )
    throw new Error(
      'Há mais de uma meta semanal. Escolha apenas uma meta antes de importar ou salvar.',
    )
  const globalIds = new Set<string>()
  if (
    data.focusSessions.filter((session) => session.status === 'in-progress')
      .length > 1
  )
    throw new Error(
      'Há mais de uma sessão de foco em andamento. Encerre uma antes de importar.',
    )
  const ids = Object.fromEntries(
    collections.map((name) => [
      name,
      new Set(data[name].map((item) => item.id)),
    ]),
  ) as Record<Collection, Set<string>>
  for (const name of collections) {
    for (const item of data[name]) {
      if (globalIds.has(item.id))
        throw new Error(
          'IDs repetidos no arquivo. Corrija os registros antes de importar.',
        )
      globalIds.add(item.id)
      if (Date.parse(item.updatedAt) < Date.parse(item.createdAt))
        throw new Error(
          'A atualização de um registro não pode ser anterior à criação.',
        )
      for (const link of item.links) {
        if (!ids[link.type].has(link.id))
          throw new Error(
            'Há vínculos para registros ausentes. Importe um backup completo.',
          )
      }
    }
  }
  const logDays = new Set<string>()
  for (const session of data.focusSessions) {
    if (session.taskId && !ids.tasks.has(session.taskId))
      throw new Error(
        'Uma sessão referencia uma tarefa ausente. Importe um backup completo.',
      )
  }
  for (const subject of data.subjects) {
    for (const event of subject.events) {
      if (event.taskId && !ids.tasks.has(event.taskId))
        throw new Error(
          'Uma prova ou entrega referencia uma tarefa ausente. Importe um backup completo.',
        )
    }
  }
  for (const path of data.studyPaths) {
    for (const step of path.steps) {
      if (
        (step.taskId && !ids.tasks.has(step.taskId)) ||
        (step.noteId && !ids.notes.has(step.noteId))
      )
        throw new Error(
          'Uma etapa referencia uma tarefa ou nota ausente. Importe um backup completo.',
        )
    }
  }
  const habitsById = new Map(data.habits.map((habit) => [habit.id, habit]))
  for (const log of data.habitLogs) {
    const habit = habitsById.get(log.habitId)
    if (!habit)
      throw new Error(
        'Há registros sem o hábito correspondente. Importe um backup completo.',
      )
    if (habit.kind === 'binary' && ![0, 1].includes(log.value))
      throw new Error('Registros binários aceitam somente 0 ou 1.')
    const key = `${log.habitId}:${log.date}`
    if (logDays.has(key))
      throw new Error('Há dois registros do mesmo hábito no mesmo dia.')
    logDays.add(key)
  }
  return data
}

// Dynamic collection operations are validated as a full snapshot before persistence.
export function replaceCollection(
  data: Snapshot,
  name: Collection,
  items: Entity[],
): Snapshot {
  return { ...data, [name]: items }
}

export function references(item: Entity): string[] {
  return [
    ...item.links.map((link) => link.id),
    ...('habitId' in item ? [item.habitId] : []),
    ...('taskId' in item && item.taskId ? [item.taskId] : []),
    ...('events' in item
      ? item.events.flatMap((event) => (event.taskId ? [event.taskId] : []))
      : []),
    ...('steps' in item
      ? item.steps.flatMap((step) =>
          [step.taskId, step.noteId].filter((id): id is string => Boolean(id)),
        )
      : []),
  ]
}

export function subtractSnapshot(data: Snapshot, removed: Snapshot): Snapshot {
  let next = { ...data }
  for (const name of collections) {
    const ids = new Set(removed[name].map((item) => item.id))
    next = replaceCollection(
      next,
      name,
      data[name].filter((item) => !ids.has(item.id)),
    )
  }
  return next
}

export interface MergeResult {
  data: Snapshot
  added: number
  skipped: number
}
export function mergeSnapshots(
  current: Snapshot,
  incoming: Snapshot,
  preserveExamples = false,
): MergeResult {
  let data = { ...current }
  const existing = new Map(
    collections.flatMap((name) =>
      current[name].map((item) => [item.id, name] as const),
    ),
  )
  const days = new Set(
    current.habitLogs.map((log) => `${log.habitId}:${log.date}`),
  )
  let added = 0
  let skipped = 0
  for (const name of collections) {
    const additions = incoming[name]
      .filter((item) => {
        const type = existing.get(item.id)
        if (type && type !== name)
          throw new Error(
            'Um ID já pertence a outro tipo de registro. Nada foi importado.',
          )
        if (
          type ||
          ('habitId' in item && days.has(`${item.habitId}:${item.date}`))
        ) {
          skipped++
          return false
        }
        added++
        return true
      })
      .map((item) => ({
        ...item,
        isExample: preserveExamples ? item.isExample : false,
      }))
    data = replaceCollection(data, name, [...data[name], ...additions])
  }
  const keys = new Set(current.experience.map((event) => event.key))
  data.experience = [
    ...current.experience,
    ...incoming.experience.filter((event) => !keys.has(event.key)),
  ]
  data.profile = current.profile ?? incoming.profile
  const activity = deduplicateActivity([
    ...current.activity,
    ...incoming.activity,
  ])
  // Preserve backup order, including during undo; presentation sorts separately.
  const activityByKey = new Map(activity.map((event) => [event.key, event]))
  data.activity = [
    ...new Set(
      [...current.activity, ...incoming.activity].map((event) => event.key),
    ),
  ].map((key) => activityByKey.get(key)!)
  return { data: validateSnapshot(data), added, skipped }
}
