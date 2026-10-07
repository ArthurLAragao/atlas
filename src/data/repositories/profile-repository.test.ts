import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { defaultProfile } from '../profile-models'
import { encodeBackup, decodeBackup } from '../../lib/transfer'
let repo: DexieAtlasRepository
beforeEach(() => {
  repo = new DexieAtlasRepository(
    createDatabase(`profile-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  await repo.database.delete()
})
describe('perfil e histórico no mesmo repository', () => {
  it('permite retirar uma referência indisponível sem apagar a possibilidade de recuperar o item', async () => {
    await repo.initialize()
    await repo.togglePinned({ type: 'projects', id: 'example-project' })
    await repo.removeExamples()
    expect((await repo.snapshot()).profile?.pinned).toHaveLength(1)
    await repo.togglePinned({ type: 'projects', id: 'example-project' })
    expect((await repo.snapshot()).profile?.pinned).toEqual([])
  })
  it('salva, exporta, limpa e restaura perfil e fixados', async () => {
    await repo.initialize()
    await repo.saveProfile({ ...defaultProfile(), name: 'Pessoa Exemplo' })
    await repo.togglePinned({ type: 'projects', id: 'example-project' })
    const before = await repo.snapshot()
    const backup = decodeBackup(encodeBackup(before))
    await repo.clearAll()
    expect((await repo.snapshot()).profile).toBeNull()
    await repo.importData(backup)
    expect((await repo.snapshot()).profile).toEqual(before.profile)
  })
  it('limita fixados a três e não duplica por reabrir', async () => {
    await repo.initialize()
    await repo.togglePinned({ type: 'projects', id: 'example-project' })
    await repo.togglePinned({
      type: 'projects',
      id: 'example-project-learning',
    })
    await repo.togglePinned({ type: 'goals', id: 'example-goal' })
    const data = await repo.snapshot()
    await expect(
      repo.togglePinned({ type: 'studyPaths', id: data.studyPaths[0]!.id }),
    ).rejects.toThrow('três')
    await repo.initialize()
    expect((await repo.snapshot()).profile?.pinned).toHaveLength(3)
  })
  it('registra conclusão uma vez sem usar XP e inclui no backup', async () => {
    await repo.initialize()
    const task = (await repo.snapshot()).tasks.find((t) => t.status !== 'done')!
    await repo.setTaskStatus(task.id, 'done')
    await repo.setTaskStatus(task.id, 'todo')
    await repo.setTaskStatus(task.id, 'done')
    const before = await repo.snapshot()
    expect(
      before.activity.filter(
        (e) => e.kind === 'task' && e.sourceId === task.id,
      ),
    ).toHaveLength(1)
    await repo.importData(decodeBackup(encodeBackup(before)))
    expect((await repo.snapshot()).activity).toEqual(before.activity)
  })
})
