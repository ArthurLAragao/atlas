import { describe, expect, it } from 'vitest'
import { experienceEvent, experienceKey, experienceSummary } from './experience'
import { emptySnapshot, snapshotSchema } from '../data/models'
import {
  decodeBackup,
  encodeBackup,
  encodeMarkdown,
  parseImport,
} from './transfer'
import { mergeSnapshots } from './data-integrity'
const date = '2026-10-03',
  earnedAt = '2026-10-03T12:00:00Z'
describe('XP independente e discreto', () => {
  it('pontua os cinco tipos por esforço, sem nível ou punição', () => {
    const events = (
      ['task', 'habit', 'focus', 'step', 'flashcard'] as const
    ).map((kind) => experienceEvent(kind, kind, date, earnedAt))
    expect(experienceSummary(events)).toMatchObject({
      total: 42,
      actions: 5,
      milestone: 'Cada passo conta',
    })
    expect(experienceSummary([])).toMatchObject({ total: 0, actions: 0 })
  })
  it('deduplica e separa dias só para hábitos e cartões', () => {
    const event = experienceEvent('task', 'task-1', date, earnedAt)
    expect(experienceSummary([event, event]).total).toBe(10)
    expect(experienceKey('task', 'task-1', '2026-10-04')).toBe(event.key)
    expect(experienceKey('habit', 'habit-1', date)).not.toBe(
      experienceKey('habit', 'habit-1', '2026-10-04'),
    )
    expect(experienceKey('flashcard', 'card-1', date)).not.toBe(
      experienceKey('flashcard', 'card-1', '2026-10-04'),
    )
  })
  it('valida chaves e datas e lê backups anteriores sem XP', () => {
    const old = emptySnapshot()
    const { experience: ignored, ...legacy } = old
    expect(ignored).toEqual([])
    expect(snapshotSchema.parse(legacy).experience).toEqual([])
    expect(() =>
      experienceEvent('habit', 'id', '2026-02-31', earnedAt),
    ).toThrow()
    expect(() =>
      snapshotSchema.parse({
        ...old,
        experience: [
          { key: 'fake', kind: 'task', sourceId: 'id', date, earnedAt },
        ],
      }),
    ).toThrow()
  })
  it('exporta e reimporta JSON/Markdown sem perder nem duplicar XP', () => {
    const data = emptySnapshot()
    data.experience = [experienceEvent('task', 'deleted-task', date, earnedAt)]
    expect(decodeBackup(encodeBackup(data))).toEqual(data)
    expect(parseImport(encodeMarkdown(data), 'atlas.md')).toEqual(data)
    expect(mergeSnapshots(data, data).data.experience).toEqual(data.experience)
  })
  it.each([50, 250, 1000])(
    'reconhece marcos sem alterar métricas em %i XP',
    (total) => {
      const events = Array.from({ length: total / 10 }, (_, index) =>
        experienceEvent('task', `id-${index}`, date, earnedAt),
      )
      expect(experienceSummary(events).total).toBe(total)
    },
  )
})
