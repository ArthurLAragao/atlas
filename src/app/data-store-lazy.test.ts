import { afterEach, expect, it, vi } from 'vitest'
import { useData } from './data-store'
import { repository } from '../data/service'
import { buildSeed } from '../data/seed'
import type { Snapshot } from '../data/models'

const gate = vi.hoisted(() => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  return { pending, release }
})
vi.mock('../lib/data-integrity', async (importOriginal) => {
  await gate.pending
  return importOriginal<typeof import('../lib/data-integrity')>()
})
afterEach(() => vi.restoreAllMocks())

it('protege links pessoais transitivos durante carga tardia, bloqueia reenvio e mantém rollback', async () => {
  const before = buildSeed()
  const first = before.notes[0]!
  const second = before.notes[1]!
  first.content = `[[${second.title}]]`
  before.notes.push({
    ...first,
    id: 'personal-9c',
    title: 'Nota pessoal 9C',
    isExample: false,
    content: `[[${first.title}]]`,
  })
  useData.setState({
    data: before,
    status: 'ready',
    busy: false,
    error: null,
    message: '',
    canUndo: false,
  })
  let fail: (error: Error) => void = () => {}
  const pending = new Promise<Snapshot>((_resolve, reject) => {
    fail = reject
  })
  const write = vi
    .spyOn(repository, 'removeExamples')
    .mockReturnValueOnce(pending)
  const firstAction = useData.getState().removeExamples()
  expect(useData.getState().busy).toBe(true)
  expect(useData.getState().data).toEqual(before)
  const duplicateAction = useData.getState().removeExamples()
  expect(write).not.toHaveBeenCalled()
  gate.release()
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
  const ids = useData.getState().data.notes.map((note) => note.id)
  expect(ids).toEqual(
    expect.arrayContaining([first.id, second.id, 'personal-9c']),
  )
  fail(new Error('Falha de escrita. Tente novamente.'))
  await Promise.all([firstAction, duplicateAction])
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().error).toContain('Falha de escrita')
  expect(useData.getState().busy).toBe(false)
})
