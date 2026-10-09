import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { sampleHabit, sampleRoutine } from '../../test/routine-fixture'
import {
  decodeBackup,
  encodeBackup,
  encodeMarkdown,
  parseImport,
} from '../../lib/transfer'
import {
  previousNight,
  scheduledDay,
  withSchedule,
} from '../../lib/habit-schedule'
import type { RoutineMapping } from '../routine-models'
let repo: DexieAtlasRepository
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-09T12:00:00'))
  repo = new DexieAtlasRepository(
    createDatabase(`routine-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await repo.database.delete()
})
const config = sampleRoutine()
const newMapping = (): RoutineMapping[] =>
  config.habits.map((h) => ({
    key: h.key,
    habitId: null,
    expectedUpdatedAt: null,
  }))
it('preserva IDs, logs, vínculos, XP e atividade ao aplicar rotina a hábitos existentes', async () => {
  const old = await repo.save('habits', sampleHabit())
  const entry = await repo.saveHabitLog({
    habitId: old.id,
    date: '2026-10-08',
    value: 1,
    rest: false,
  })
  const before = await repo.snapshot()
  const mapping = newMapping()
  mapping[0] = {
    key: config.habits[0]!.key,
    habitId: old.id,
    expectedUpdatedAt: old.updatedAt,
  }
  const after = await repo.applyRoutine(config, mapping, null)
  const mapped = after.habits.find((h) => h.id === old.id)!
  expect(after.habits).toHaveLength(11)
  expect(mapped.id).toBe(old.id)
  expect(after.habitLogs).toEqual([entry])
  expect(after.experience).toEqual(before.experience)
  expect(after.activity).toEqual(before.activity)
  expect(scheduledDay(mapped, '2026-10-08').label).toBe(old.title)
  expect(scheduledDay(mapped, '2026-10-09').label).toBe(
    `${config.habits[0]!.title} 5`,
  )
  await repo.saveHabitLog({
    habitId: old.id,
    date: '2026-10-08',
    value: 1,
    rest: false,
  })
  expect((await repo.snapshot()).experience).toEqual(before.experience)
  expect((await repo.snapshot()).activity).toEqual(before.activity)
})
it('restaura ida/volta integral após limpar somente banco descartável', async () => {
  const first = await repo.applyRoutine(config, newMapping(), null)
  await repo.saveHabitLog({
    habitId: first.habits[0]!.id,
    date: '2026-10-08',
    value: 1,
    rest: false,
  })
  const data = await repo.snapshot(),
    json = encodeBackup(data),
    md = encodeMarkdown(data)
  await repo.clearAll()
  expect((await repo.snapshot()).routine).toBeUndefined()
  expect((await repo.importData(decodeBackup(json))).data).toEqual(data)
  await repo.clearAll()
  expect((await repo.importData(parseImport(md, 'backup.md'))).data).toEqual(
    data,
  )
  repo.database.close()
  await repo.database.open()
  expect(await repo.snapshot()).toEqual(data)
})
it('concorrência de duas abas rejeita edição e reaplicação obsoletas, sem alteração parcial', async () => {
  const old = await repo.save('habits', sampleHabit())
  const before = await repo.snapshot()
  const mapping = newMapping()
  mapping[0] = {
    key: config.habits[0]!.key,
    habitId: old.id,
    expectedUpdatedAt: old.updatedAt,
  }
  await repo.save(
    'habits',
    { ...old, title: 'Atualizado em outra aba' },
    old.updatedAt,
  )
  await expect(repo.applyRoutine(config, mapping, null)).rejects.toThrow(
    'outra aba',
  )
  expect((await repo.snapshot()).routine).toBeUndefined()
  expect((await repo.snapshot()).habits).toHaveLength(before.habits.length)
  const second = new DexieAtlasRepository(createDatabase(repo.database.name))
  try {
    const applied = await repo.applyRoutine(config, newMapping(), null)
    await expect(
      second.applyRoutine(config, newMapping(), null),
    ).rejects.toThrow('outra aba')
    expect(await repo.snapshot()).toEqual(applied)
    const stale = applied.habits[1]!
    await second.save(
      'habits',
      { ...stale, title: 'Nova edição' },
      stale.updatedAt,
    )
    await expect(repo.save('habits', stale, stale.updatedAt)).rejects.toThrow(
      'outra aba',
    )
  } finally {
    second.database.close()
  }
})
it('falha de armazenamento reverte a aplicação inteira', async () => {
  const before = await repo.snapshot()
  vi.spyOn(repo.database.table('meta'), 'put').mockRejectedValueOnce(
    new Error('QuotaExceededError'),
  )
  await expect(repo.applyRoutine(config, newMapping(), null)).rejects.toThrow()
  expect(await repo.snapshot()).toEqual(before)
})
it('banco antigo v3 e backup sem programação permanecem utilizáveis', async () => {
  const old = sampleHabit()
  await repo.database.table('habits').put(old)
  const data = await repo.snapshot()
  expect(data.habits).toEqual([old])
  expect(data.routine).toBeUndefined()
  expect(scheduledDay(data.habits[0]!, '2026-10-09').scheduled).toBe(true)
  const log = await repo.saveHabitLog({
    habitId: old.id,
    date: '2026-10-08',
    value: 1,
    rest: false,
  })
  expect(log.habitId).toBe(old.id)
})
it('02h30 com dayOffset 1 salva somente na data explícita da noite anterior', async () => {
  const habit = await repo.save(
    'habits',
    withSchedule(
      sampleHabit(),
      {
        mode: 'daily',
        timesPerWeek: 7,
        days: [5, 6].map((weekday) => ({
          weekday,
          time: '02:30',
          dayOffset: 1,
          order: 0,
          optional: false,
        })),
      },
      '2026-10-09',
    ),
  )
  vi.setSystemTime(new Date('2026-10-10T02:30:00'))
  const night = previousNight([habit], '2026-10-10')
  expect(night.date).toBe('2026-10-09')
  expect(night.habits.map((h) => h.id)).toEqual([habit.id])
  const input = { habitId: habit.id, date: night.date, value: 1, rest: false }
  await repo.saveHabitLog(input)
  const before = await repo.snapshot()
  await repo.saveHabitLog(input)
  const after = await repo.snapshot()
  expect(after.habitLogs).toHaveLength(1)
  expect(after.habitLogs[0]).toMatchObject({
    habitId: habit.id,
    date: '2026-10-09',
    value: 1,
  })
  expect(after.habitLogs.some((l) => l.date === '2026-10-10')).toBe(false)
  expect(after.experience).toEqual(before.experience)
  expect(after.activity).toEqual(before.activity)
})
