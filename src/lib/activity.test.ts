import { describe, it, expect } from 'vitest'
import {
  activityDays,
  activityGrid,
  activityIntensity,
  activityStreaks,
  deduplicateActivity,
  activityEvents,
} from './activity'
import { emptySnapshot } from '../data/models'
import type { ActivityEvent } from '../data/profile-models'
const event = (date: string, id = date): ActivityEvent => ({
  key: `task:${id}`,
  kind: 'task',
  sourceId: id,
  title: 'Estudar',
  date,
  at: `${date}T12:00:00Z`,
  value: 1,
})
describe('atividade privada independente de XP', () => {
  it('deduplica por origem e preserva a última versão', () =>
    expect(
      deduplicateActivity([event('2026-10-01', 'a'), event('2026-10-02', 'a')]),
    ).toEqual([event('2026-10-02', 'a')]))
  it('conta ações por tipo e ignora o futuro', () => {
    const days = activityDays(
      [event('2026-10-01', 'a'), event('2026-10-01', 'b'), event('2026-10-05')],
      '2026-10-03',
    )
    expect(days.size).toBe(1)
    expect(days.get('2026-10-01')?.points).toBe(2)
  })
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [6, 3],
    [7, 4],
    [100, 4],
  ])('intensidade %i → %i', (points, level) =>
    expect(activityIntensity(points)).toBe(level),
  )
  it('preserva o dia atual em aberto e mede o melhor histórico', () => {
    const events = ['2026-09-29', '2026-09-30', '2026-10-01'].map((d) =>
      event(d),
    )
    expect(activityStreaks(events, '2026-10-02')).toEqual({
      current: 3,
      best: 3,
    })
    expect(activityStreaks(events, '2026-10-03')).toEqual({
      current: 0,
      best: 3,
    })
  })
  it('atravessa mês, ano e ano bissexto', () =>
    expect(
      activityStreaks(
        ['2024-02-28', '2024-02-29', '2024-03-01'].map((d) => event(d)),
        '2024-03-01',
      ).current,
    ).toBe(3))
  it.each([13, 26, 52])(
    'gera %i semanas com dias futuros sem ações',
    (weeks) => {
      const grid = activityGrid([event('2026-10-03')], '2026-10-03', weeks)
      expect(grid).toHaveLength(weeks)
      expect(grid.every((w) => w.length === 7)).toBe(true)
      expect(grid.flat().find((d) => d.date === '2026-10-03')?.level).toBe(1)
    },
  )
  it('não transforma XP em atividade', () => {
    const data = emptySnapshot()
    data.experience = [
      {
        key: 'task:a',
        kind: 'task',
        sourceId: 'a',
        date: '2026-10-01',
        earnedAt: '2026-10-01T12:00:00Z',
      },
    ]
    expect(activityEvents(data)).toEqual([])
  })
})
