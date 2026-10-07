import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useData } from './data-store'
import { repository } from '../data/service'
import { buildSeed } from '../data/seed'
import { emptySnapshot, type Snapshot } from '../data/models'
import { recordCount } from '../lib/data-integrity'

beforeEach(() =>
  useData.setState({
    data: buildSeed(),
    status: 'ready',
    busy: false,
    error: null,
    message: '',
    canUndo: false,
  }),
)
afterEach(() => vi.restoreAllMocks())

it('remove otimisticamente e restaura os dados se o banco falhar', async () => {
  let fail: (error: Error) => void = () => {}
  const pending = new Promise<Snapshot>((_resolve, reject) => {
    fail = reject
  })
  vi.spyOn(repository, 'removeExamples').mockReturnValueOnce(pending)
  const action = useData.getState().removeExamples()
  expect(recordCount(useData.getState().data)).toBe(0)
  expect(useData.getState().busy).toBe(true)
  fail(new Error('Falha de escrita. Tente novamente.'))
  await action
  expect(recordCount(useData.getState().data)).toBe(20)
  expect(useData.getState().busy).toBe(false)
  expect(useData.getState().error).toContain('Falha de escrita')
  expect(useData.getState().canUndo).toBe(false)
})

it('não relata importação concluída quando a escrita falha', async () => {
  useData.setState({ message: 'Importação anterior concluída.' })
  vi.spyOn(repository, 'importData').mockRejectedValueOnce(
    new DOMException('full', 'QuotaExceededError'),
  )
  expect(await useData.getState().importData(emptySnapshot())).toBe(false)
  expect(recordCount(useData.getState().data)).toBe(20)
  expect(useData.getState().message).toBe('')
  expect(useData.getState().error).toContain('armazenamento está cheio')
})
