import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'

vi.mock('../../lib/note-links', () => {
  throw new Error('Parser indisponível no teste.')
})

let repo: DexieAtlasRepository
beforeEach(() => {
  repo = new DexieAtlasRepository(
    createDatabase(`audit-9c-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  await repo.database.delete()
})

it('inicializa banco vazio/existente e conclui tarefa sem carregar o parser', async () => {
  await repo.initialize()
  const before = await repo.snapshot()
  expect(before.tasks.length).toBeGreaterThan(0)
  await repo.setTaskStatus(before.tasks[0]!.id, 'done')
  repo.database.close()
  await repo.database.open()
  await repo.initialize()
  const after = await repo.snapshot()
  expect(after.tasks).toHaveLength(before.tasks.length)
  expect(after.tasks[0]!.status).toBe('done')
  expect(after.notes).toEqual(before.notes)
})

it('falha de carga anterior à transação não altera notas nem remove exemplos', async () => {
  await repo.initialize()
  const before = await repo.snapshot()
  const note = before.notes[0]!
  await expect(
    repo.saveNote({ ...note, title: 'Novo título' }, note.updatedAt),
  ).rejects.toMatchObject({
    cause: expect.objectContaining({ message: 'Parser indisponível no teste.' }),
  })
  expect(await repo.snapshot()).toEqual(before)
  await expect(repo.removeExamples()).rejects.toMatchObject({
    cause: expect.objectContaining({ message: 'Parser indisponível no teste.' }),
  })
  expect(await repo.snapshot()).toEqual(before)
  expect(await repo.canUndoExamples()).toBe(false)
})
