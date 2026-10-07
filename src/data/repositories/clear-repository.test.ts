import { afterEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { collections, emptySnapshot } from '../models'
import { encodeBackup, decodeBackup } from '../../lib/transfer'
const repository = new DexieAtlasRepository(
  createDatabase(`clear-${crypto.randomUUID()}`),
)
afterEach(async () => {
  await repository.database.delete()
})
describe('limpeza forte de dados', () => {
  it('apaga todas as tabelas, evita retorno de exemplos e reimporta tudo', async () => {
    await repository.initialize()
    const before = await repository.snapshot()
    for (const name of collections)
      for (const item of before[name]) item.isExample = false
    const backup = encodeBackup(before)
    await repository.clearAll()
    expect(await repository.snapshot()).toEqual(emptySnapshot())
    await repository.initialize()
    expect(await repository.snapshot()).toEqual(emptySnapshot())
    expect(await repository.canUndoExamples()).toBe(false)
    await repository.importData(decodeBackup(backup))
    expect(await repository.snapshot()).toEqual(before)
  })
})
