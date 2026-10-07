import { experienceEventSchema, type ExperienceEvent } from '../data/models.js'
export type ExperienceKind = ExperienceEvent['kind']
export const experiencePoints: Record<ExperienceKind, number> = {
  task: 10,
  habit: 5,
  focus: 15,
  step: 10,
  flashcard: 2,
}
/** Once per task/session/step, once per calendar day for habits/cards. Never subtract XP. */
export function experienceKey(
  kind: ExperienceKind,
  sourceId: string,
  date: string,
): string {
  return `${kind}:${sourceId}${kind === 'habit' || kind === 'flashcard' ? `:${date}` : ''}`
}
export function experienceEvent(
  kind: ExperienceKind,
  sourceId: string,
  date: string,
  earnedAt: string,
): ExperienceEvent {
  return experienceEventSchema.parse({
    kind,
    sourceId,
    date,
    earnedAt,
    key: experienceKey(kind, sourceId, date),
  })
}
export function experienceSummary(events: readonly ExperienceEvent[]) {
  const unique = new Map(events.map((event) => [event.key, event]))
  const total = [...unique.values()].reduce(
    (sum, event) => sum + experiencePoints[event.kind],
    0,
  )
  return {
    total,
    actions: unique.size,
    milestone:
      total >= 1000
        ? 'Mil pequenos passos'
        : total >= 250
          ? 'Constância em construção'
          : total >= 50
            ? 'Primeiros passos'
            : 'Cada passo conta',
  }
}
