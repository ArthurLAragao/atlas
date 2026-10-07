import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { emptySnapshot, type Habit, type Note } from '../models'
import { recordCount } from '../../lib/data-integrity'
import { DexieAtlasRepository } from './dexie-repository'

let repository: DexieAtlasRepository
beforeEach(() => {
  repository = new DexieAtlasRepository(
    createDatabase(`atlas-habits-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  await repository.database.delete()
})

const habit = (id = 'water'): Habit => ({
  id,
  title: 'Água',
  kind: 'quantity',
  target: 3,
  unit: 'L',
  timesPerWeek: 7,
  tags: ['saúde'],
  links: [],
  isExample: false,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
})
const note = (): Note => ({
  id: 'habit-note',
  title: 'Minha rotina',
  content: 'Água ao longo do dia.',
  tags: [],
  links: [{ type: 'habits', id: 'water' }],
  isExample: false,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
})
const input = {
  habitId: 'water',
  date: '2020-01-01',
  value: 1.5,
  rest: false,
}

describe('registros de hábitos persistentes', () => {
  it('serializa registros concorrentes do mesmo dia sem duplicar ou perder o ID', async () => {
    await repository.save('habits', habit())
    const [first, second] = await Promise.all([
      repository.saveHabitLog(input),
      repository.saveHabitLog({ ...input, value: 3 }),
    ])
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(await repository.list('habitLogs')).toEqual([second])
    expect(second.value).toBe(3)
  })

  it('mantém metadados do registro e normaliza descanso para valor zero', async () => {
    await repository.save('habits', habit())
    const original = await repository.saveHabitLog(input)
    const withMetadata = await repository.save('habitLogs', {
      ...original,
      tags: ['férias'],
      links: [{ type: 'habits', id: 'water' }],
    })
    const rest = await repository.saveHabitLog({
      ...input,
      rest: true,
      value: 10,
    })
    expect(rest).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      tags: withMetadata.tags,
      links: withMetadata.links,
      value: 0,
      rest: true,
      isExample: false,
    })
  })

  it('protege o hábito de exemplo quando seu registro passa a ser pessoal', async () => {
    await repository.initialize()
    const example = (await repository.list('habitLogs'))[0]!
    const changed = await repository.saveHabitLog({
      habitId: example.habitId,
      date: example.date,
      value: 45,
      rest: false,
    })
    expect(changed.id).toBe(example.id)
    expect(changed.createdAt).toBe(example.createdAt)
    expect(changed.isExample).toBe(false)
    await repository.removeExamples()
    expect(await repository.get('habits', example.habitId)).toBeDefined()
    expect(await repository.list('habitLogs')).toEqual([changed])
  })

  it.each([
    { ...input, date: '9999-12-31' },
    { ...input, date: '2020-02-30' },
    { ...input, date: '01/01/2020' },
    { ...input, value: -1 },
    { ...input, value: Number.NaN },
    { ...input, habitId: 'missing' },
  ])('rejeita entrada inválida sem alterar o banco: %j', async (invalid) => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    const before = await repository.snapshot()
    await expect(repository.saveHabitLog(invalid)).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(before)
  })

  it('aceita descanso binário e rejeita valores binários fora de zero ou um', async () => {
    await repository.save('habits', { ...habit(), kind: 'binary', target: 1 })
    await expect(repository.saveHabitLog(input)).rejects.toThrow(/binários/)
    const rest = await repository.saveHabitLog({ ...input, rest: true })
    expect(rest.value).toBe(0)
    expect(rest.rest).toBe(true)
    await repository.saveHabitLog({ ...input, value: 1 })
    expect((await repository.list('habitLogs'))[0]?.value).toBe(1)
  })

  it('bloqueia troca de tipo com histórico e permite mudar o alvo sem apagar valores', async () => {
    const saved = await repository.save('habits', habit())
    const log = await repository.saveHabitLog(input)
    await expect(
      repository.save('habits', { ...saved, kind: 'binary', target: 1 }),
    ).rejects.toThrow(/Crie outro hábito/)
    await repository.save('habits', { ...saved, target: 4 })
    expect((await repository.get('habits', saved.id))?.target).toBe(4)
    expect(await repository.get('habitLogs', log.id)).toEqual(log)
  })

  it('remove hábito e histórico juntos e desfaz após reabrir, sem duplicar', async () => {
    await repository.initialize()
    await repository.removeExamples()
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    await repository.saveHabitLog({ ...input, date: '2020-01-02', value: 3 })
    const before = await repository.snapshot()
    const removed = await repository.removeHabit('water')
    expect(recordCount(removed)).toBe(3)
    expect(await repository.snapshot()).toEqual({
      ...emptySnapshot(),
      experience: before.experience,
      activity: before.activity,
    })
    repository.database.close()
    await repository.database.open()
    await repository.initialize()
    expect(await repository.snapshot()).toEqual({
      ...emptySnapshot(),
      experience: before.experience,
      activity: before.activity,
    })
    expect(await repository.canUndoHabitRemoval()).toBe(true)
    expect((await repository.undoHabitRemoval()).added).toBe(3)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoHabitRemoval()).toBe(false)
    expect((await repository.undoHabitRemoval()).added).toBe(0)
    expect(await repository.snapshot()).toEqual(before)
  })

  it('bloqueia remoção de hábito vinculado e mantém dados e desfazer intactos', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    await repository.saveHabitLog({ ...input, date: '2020-01-02' })
    await repository.removeHabitLog('water', '2020-01-02')
    await repository.save('notes', note())
    const before = await repository.snapshot()
    await expect(repository.removeHabit('water')).rejects.toThrow(/vínculos/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoHabitRemoval()).toBe(true)
    expect((await repository.undoHabitRemoval()).added).toBe(1)
  })

  it('desfaz remoção de dia sem sobrescrever um registro criado depois', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    expect(
      recordCount(await repository.removeHabitLog('water', input.date)),
    ).toBe(1)
    const newLog = await repository.saveHabitLog({ ...input, value: 3 })
    const result = await repository.undoHabitRemoval()
    expect(result.added).toBe(0)
    expect(result.skipped).toBe(1)
    expect(await repository.list('habitLogs')).toEqual([newLog])
    expect(await repository.canUndoHabitRemoval()).toBe(false)
  })

  it('restaura histórico e vínculos sem sobrescrever um hábito já recriado', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    const before = await repository.snapshot()
    await repository.removeHabit('water')
    const recreated = await repository.save('habits', {
      ...habit(),
      title: 'Água durante o estudo',
      target: 4,
    })
    const restored = await repository.undoHabitRemoval()
    expect(restored.added).toBe(1)
    expect(restored.skipped).toBe(1)
    expect(await repository.get('habits', 'water')).toEqual(recreated)
    expect(await repository.list('habitLogs')).toEqual(before.habitLogs)
  })

  it('mantém o desfazer disponível se restauração conflitar com novo tipo', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    await repository.removeHabit('water')
    await repository.save('habits', { ...habit(), kind: 'binary', target: 1 })
    const before = await repository.snapshot()
    await expect(repository.undoHabitRemoval()).rejects.toThrow(/binários/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoHabitRemoval()).toBe(true)
  })

  it('exclusão inexistente não substitui a última ação que pode ser desfeita', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    await repository.removeHabitLog('water', input.date)
    expect(recordCount(await repository.removeHabit('missing'))).toBe(0)
    expect(
      recordCount(await repository.removeHabitLog('water', '2020-02-01')),
    ).toBe(0)
    expect((await repository.undoHabitRemoval()).added).toBe(1)
  })

  it('reverte exclusão inteira e metadados se uma escrita falhar', async () => {
    await repository.save('habits', habit())
    await repository.saveHabitLog(input)
    const before = await repository.snapshot()
    vi.spyOn(
      repository.database.table('habitLogs'),
      'bulkPut',
    ).mockRejectedValueOnce(new Error('Falha simulada'))
    await expect(repository.removeHabit('water')).rejects.toThrow(
      'Falha simulada',
    )
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoHabitRemoval()).toBe(false)
  })
})
