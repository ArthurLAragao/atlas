import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import { buildSeed } from '../../data/seed'
import { learningChange, useLearning } from './learning-store'

beforeEach(() => {
  vi.spyOn(repository, 'canUndoFocusTask').mockResolvedValue(false)
  useData.setState({ data: buildSeed(), busy: false, status: 'ready' })
  useLearning.setState({
    error: '',
    message: '',
    canUndo: false,
    canUndoFocus: false,
  })
})
afterEach(() => vi.restoreAllMocks())
it('reverte mutação otimista se a escrita falhar e não informa sucesso', async () => {
  const before = useData.getState().data
  vi.spyOn(repository, 'snapshot').mockResolvedValue(before)
  const ok = await learningChange(
    async () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
    'Sucesso',
    { ...before, notes: [] },
  )
  expect(ok).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useLearning.getState().error).toMatch(/armazenamento/)
  expect(useLearning.getState().message).toBe('')
})
it('falha ao ler snapshot mantém o último estado conhecido', async () => {
  const before = useData.getState().data
  vi.spyOn(repository, 'snapshot').mockRejectedValue(new Error('read failed'))
  await learningChange(async () => {
    throw new Error('Permita salvar e tente novamente.')
  }, 'Pronto')
  expect(useData.getState().data).toEqual(before)
  expect(useLearning.getState().error).toMatch(/Permita salvar/)
})
it('não envia duas operações enquanto uma gravação está em andamento', async () => {
  let finish: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  vi.spyOn(repository, 'canUndoFlashcard').mockResolvedValue(false)
  const first = learningChange(async () => {
    await pending
    return useData.getState().data
  }, 'Salvo')
  const duplicate = vi.fn(async () => useData.getState().data)
  expect(await learningChange(duplicate, 'Duplicado')).toBe(false)
  expect(duplicate).not.toHaveBeenCalled()
  finish()
  expect(await first).toBe(true)
})
it('falha na consulta de desfazer não transforma gravação confirmada em erro', async () => {
  vi.spyOn(repository, 'canUndoFlashcard').mockRejectedValue(
    new Error('history failed'),
  )
  const confirmed = { ...useData.getState().data, notes: [] }
  expect(await learningChange(async () => confirmed, 'Salvo')).toBe(true)
  expect(useData.getState().data).toEqual(confirmed)
  expect(useLearning.getState().message).toBe('Salvo')
  expect(useLearning.getState().error).toBe('')
})
