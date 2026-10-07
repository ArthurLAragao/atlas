import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { buildSeed } from '../../data/seed'
import { repository } from '../../data/service'
import type { Snapshot, Task } from '../../data/models'
import { RepositoryConflictError } from '../../data/conflict-error'
import { useTasks } from './task-store'

beforeEach(() => {
  useData.setState({
    data: buildSeed(),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useTasks.setState({ error: null, message: '', canUndo: false })
})
afterEach(() => vi.restoreAllMocks())

it('recupera o snapshot da outra aba após conflito sem confirmar nem sobrescrever seu estado', async () => {
  const before = useData.getState().data
  const task = before.tasks[0]!
  const latest = {
    ...before,
    tasks: before.tasks.map((item) =>
      item.id === task.id ? { ...item, title: 'Salva em outra aba' } : item,
    ),
  }
  vi.spyOn(repository, 'save').mockRejectedValue(
    new RepositoryConflictError('Mudou em outra aba'),
  )
  vi.spyOn(repository, 'snapshot').mockResolvedValue(latest)
  expect(
    await useTasks
      .getState()
      .save({ ...task, title: 'Rascunho antigo' }, task.updatedAt),
  ).toBe(false)
  expect(useData.getState().data).toEqual(latest)
  expect(useTasks.getState().message).toBe('')
  expect(useTasks.getState().error).toContain('outra aba')
})

it('não anuncia falha nem reverte conclusão já confirmada quando só a leitura de undo falha', async () => {
  const before = useData.getState().data
  const task = before.tasks[0]!
  const saved = { ...task, status: 'done' as const, isExample: false }
  const persisted = {
    ...before,
    tasks: before.tasks.map((item) => (item.id === task.id ? saved : item)),
  }
  vi.spyOn(repository, 'setTaskStatus').mockResolvedValue(saved)
  vi.spyOn(repository, 'snapshot').mockResolvedValue(persisted)
  vi.spyOn(repository, 'canUndoTaskRemoval').mockRejectedValue(
    new Error('Leitura temporariamente indisponível'),
  )
  expect(await useTasks.getState().status(task, 'done')).toBe(true)
  expect(useData.getState().data).toEqual(persisted)
  expect(useTasks.getState().error).toBeNull()
  expect(useTasks.getState().message).toBe('Tarefa concluída.')
})

it('mostra conclusão imediatamente, bloqueia segunda ação e restaura dados se o armazenamento falhar', async () => {
  const before = useData.getState().data
  const task = before.tasks[0]!
  let fail: (error: Error) => void = () => {}
  const status = vi.spyOn(repository, 'setTaskStatus').mockReturnValueOnce(
    new Promise<Task>((_resolve, reject) => {
      fail = reject
    }),
  )
  const remove = vi.spyOn(repository, 'removeTask')
  const pending = useTasks.getState().status(task, 'done')
  expect(useData.getState().busy).toBe(true)
  expect(
    useData.getState().data.tasks.find((item) => item.id === task.id),
  ).toMatchObject({ status: 'done', isExample: false })
  const optimistic = useData.getState().data
  expect(await useTasks.getState().remove(before.tasks[1]!.id)).toBe(false)
  expect(remove).not.toHaveBeenCalled()
  expect(status).toHaveBeenCalledExactlyOnceWith(task.id, 'done')
  expect(useData.getState().data).toEqual(optimistic)
  fail(new DOMException('full', 'QuotaExceededError'))
  expect(await pending).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useTasks.getState().canUndo).toBe(false)
  expect(useTasks.getState().message).toBe('')
  expect(useTasks.getState().error).toContain('armazenamento está cheio')
})

it('reverte exclusão otimista protegida por vínculos e preserva o desfazer anterior', async () => {
  const before = useData.getState().data
  const task = before.tasks[0]!
  useTasks.setState({ canUndo: true, message: 'Tarefa salva.' })
  let fail: (error: Error) => void = () => {}
  vi.spyOn(repository, 'removeTask').mockReturnValueOnce(
    new Promise<Snapshot>((_resolve, reject) => {
      fail = reject
    }),
  )
  const pending = useTasks.getState().remove(task.id)
  expect(useData.getState().data.tasks).toHaveLength(before.tasks.length - 1)
  expect(
    useData.getState().data.tasks.some((item) => item.id === task.id),
  ).toBe(false)
  expect(useData.getState().data.goals).toEqual(before.goals)
  expect(useData.getState().busy).toBe(true)
  fail(
    new Error(
      'Esta tarefa possui vínculos. Remova os vínculos antes de excluir.',
    ),
  )
  expect(await pending).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useTasks.getState().canUndo).toBe(true)
  expect(useTasks.getState().message).toBe('')
  expect(useTasks.getState().error).toContain('Remova os vínculos')
})
