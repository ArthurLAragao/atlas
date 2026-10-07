import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import type { Goal } from '../../data/models'
import { buildSeed } from '../../data/seed'
import { repository } from '../../data/service'
import { useToday } from './today-store'

beforeEach(() => {
  useData.setState({
    data: buildSeed(),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useToday.setState({ error: null, message: '' })
})
afterEach(() => vi.restoreAllMocks())

it('mostra a meta imediatamente, bloqueia gravação simultânea e restaura dados após quota', async () => {
  const before = useData.getState().data
  const goal = { ...before.goals[0]!, title: 'Concluir o capítulo de AWS' }
  let fail: (error: Error) => void = () => {}
  const save = vi.spyOn(repository, 'save').mockReturnValueOnce(
    new Promise<Goal>((_resolve, reject) => {
      fail = reject
    }),
  )
  const pending = useToday.getState().saveGoal(goal)
  expect(useData.getState().busy).toBe(true)
  expect(
    useData.getState().data.goals.find((item) => item.id === goal.id),
  ).toEqual({
    ...goal,
    isExample: false,
  })
  const optimistic = useData.getState().data
  expect(
    await useToday.getState().saveGoal({ ...goal, title: 'Outra meta' }),
  ).toBe(false)
  expect(save).toHaveBeenCalledExactlyOnceWith('goals', goal)
  expect(useData.getState().data).toEqual(optimistic)
  fail(new DOMException('full', 'QuotaExceededError'))
  expect(await pending).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useToday.getState().message).toBe('')
  expect(useToday.getState().error).toContain('armazenamento está cheio')
})

it('mantém metadados e coleções ao salvar e usa o resultado persistido para confirmar', async () => {
  const before = useData.getState().data
  const goal: Goal = {
    ...before.goals[0]!,
    title: 'Revisar AWS',
    isExample: false,
    links: [{ type: 'tasks', id: before.tasks[0]!.id }],
    keyResults: [{ id: 'chapter', title: 'Capítulos', target: 3, current: 1 }],
  }
  const stored = { ...goal, updatedAt: '2026-10-02T12:00:00Z' }
  const snapshot = { ...before, goals: [stored] }
  const save = vi.spyOn(repository, 'save').mockResolvedValueOnce(stored)
  const read = vi
    .spyOn(repository, 'snapshot')
    .mockRejectedValueOnce(new DOMException('closed', 'DatabaseClosedError'))
  useToday.setState({ error: 'Erro anterior', message: 'Aviso anterior' })
  expect(await useToday.getState().saveGoal(goal)).toBe(true)
  expect(read).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledExactlyOnceWith('goals', goal)
  expect(useData.getState().data).toEqual(snapshot)
  expect(useData.getState().data.tasks).toBe(before.tasks)
  expect(useData.getState().data.goals[0]).toEqual(stored)
  expect(useData.getState().busy).toBe(false)
  expect(useToday.getState().error).toBeNull()
  expect(useToday.getState().message).toBe('Meta da semana salva.')
  useToday.getState().dismiss()
  expect(useToday.getState().message).toBe('')
})

it('preserva sessão ocupada e não inicia escrita concorrente com outra feature', async () => {
  const before = useData.getState().data
  useData.setState({ busy: true })
  const save = vi.spyOn(repository, 'save')
  expect(await useToday.getState().saveGoal(before.goals[0]!)).toBe(false)
  expect(save).not.toHaveBeenCalled()
  expect(useData.getState().data).toBe(before)
  expect(useData.getState().busy).toBe(true)
})

it('escolha semanal confirma snapshot inteiro e mantém campos manuais com versão esperada', async () => {
  const before = useData.getState().data
  const goal: Goal = {
    ...before.goals[0]!,
    weekly: true,
    description: 'Propósito preservado',
    status: 'completed',
    isExample: false,
  }
  const stored = { ...goal, updatedAt: '2026-10-03T12:00:00Z' }
  const data = { ...before, goals: [stored] }
  const save = vi
    .spyOn(repository, 'saveDirection')
    .mockResolvedValueOnce({ data, saved: stored })
  const legacy = vi.spyOn(repository, 'save')
  const snapshot = vi.spyOn(repository, 'snapshot')
  expect(await useToday.getState().saveGoal(goal)).toBe(true)
  expect(save).toHaveBeenCalledExactlyOnceWith('goals', goal, goal.updatedAt)
  expect(legacy).not.toHaveBeenCalled()
  expect(snapshot).not.toHaveBeenCalled()
  expect(useData.getState().data).toEqual(data)
})

it('conflito da escolha semanal recupera a medida atual do banco', async () => {
  const before = useData.getState().data
  const goal = { ...before.goals[0]!, weekly: true }
  const concurrent = {
    ...before,
    goals: [
      {
        ...goal,
        keyResults: [{ id: 'hours', title: 'Horas', current: 8, target: 30 }],
      },
    ],
  }
  vi.spyOn(repository, 'saveDirection').mockRejectedValueOnce(
    new Error('A meta mudou. Abra novamente.'),
  )
  vi.spyOn(repository, 'snapshot').mockResolvedValueOnce(concurrent)
  expect(await useToday.getState().saveGoal(goal)).toBe(false)
  expect(useData.getState().data).toEqual(concurrent)
  expect(useToday.getState().error).toContain('A meta mudou')
})
