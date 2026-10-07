import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { buildSeed } from '../../data/seed'
import { repository } from '../../data/service'
import type { Snapshot } from '../../data/models'
import { RepositoryConflictError } from '../../data/conflict-error'
import { useHabits } from './habit-store'

beforeEach(() => {
  useData.setState({ data: buildSeed(), busy: false, status: 'ready' })
  useHabits.setState({ error: null, message: '', canUndo: false })
})
afterEach(() => vi.restoreAllMocks())

it('recupera hábito mais recente após conflito, sem confirmar o rascunho antigo', async () => {
  const before = useData.getState().data
  const habit = before.habits[0]!
  const latest = {
    ...before,
    habits: before.habits.map((item) =>
      item.id === habit.id ? { ...item, title: 'Outro nome salvo' } : item,
    ),
  }
  vi.spyOn(repository, 'save').mockRejectedValue(
    new RepositoryConflictError('Mudou em outra aba'),
  )
  vi.spyOn(repository, 'snapshot').mockResolvedValue(latest)
  expect(await useHabits.getState().save(habit, habit.updatedAt)).toBe(false)
  expect(useData.getState().data).toEqual(latest)
  expect(useHabits.getState().message).toBe('')
  expect(useHabits.getState().error).toContain('outra aba')
})

it('conserva sucesso de hábito confirmado se a leitura separada de undo falhar', async () => {
  const before = useData.getState().data
  const habit = { ...before.habits[0]!, title: 'Nome salvo', isExample: false }
  const persisted = {
    ...before,
    habits: before.habits.map((item) => (item.id === habit.id ? habit : item)),
  }
  vi.spyOn(repository, 'save').mockResolvedValue(habit)
  vi.spyOn(repository, 'snapshot').mockResolvedValue(persisted)
  vi.spyOn(repository, 'canUndoHabitRemoval').mockRejectedValue(
    new Error('Leitura indisponível'),
  )
  expect(await useHabits.getState().save(habit)).toBe(true)
  expect(useData.getState().data).toEqual(persisted)
  expect(useHabits.getState().error).toBeNull()
  expect(useHabits.getState().message).toBe('Hábito salvo.')
})

it('mostra exclusão imediatamente e restaura hábito e logs se a transação falhar', async () => {
  const before = useData.getState().data
  let fail: (error: Error) => void = () => {}
  vi.spyOn(repository, 'removeHabit').mockReturnValueOnce(
    new Promise<Snapshot>((_resolve, reject) => {
      fail = reject
    }),
  )
  const pending = useHabits.getState().remove('example-habit-2')
  expect(useData.getState().data.habits).toHaveLength(5)
  expect(useData.getState().data.habitLogs).toHaveLength(0)
  expect(useData.getState().busy).toBe(true)
  fail(new Error('Falha de escrita. Tente novamente.'))
  expect(await pending).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useHabits.getState().canUndo).toBe(false)
  expect(useHabits.getState().message).toBe('')
  expect(useHabits.getState().error).toContain('Falha de escrita')
})

it('restaura o registro anterior quando o armazenamento está cheio', async () => {
  const before = useData.getState().data
  vi.spyOn(repository, 'saveHabitLog').mockRejectedValueOnce(
    new DOMException('full', 'QuotaExceededError'),
  )
  expect(
    await useHabits
      .getState()
      .log('example-habit-2', before.habitLogs[0]!.date, 45, false),
  ).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useHabits.getState().message).toBe('')
  expect(useHabits.getState().error).toContain('armazenamento está cheio')
})
