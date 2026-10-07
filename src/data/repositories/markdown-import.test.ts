import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { parseMarkdownNote } from '../../lib/markdown-import'
import { encodeBackup, parseImport, maxImportBytes } from '../../lib/transfer'
let repo: DexieAtlasRepository
beforeEach(async () => {
  repo = new DexieAtlasRepository(
    createDatabase(`markdown-${crypto.randomUUID()}`),
  )
  await repo.initialize()
})
afterEach(async () => {
  await repo.database.delete()
})
const note = (text: string, id: string) =>
  parseMarkdownNote(text, 'nota.md', new Date().toISOString(), id).note
it('importa atomicamente, não sobrescreve, restaura backup e usa IDs novos para cópias', async () => {
  const first = note('# Aula\n[[Outra]]', 'a'),
    other = note('# Outra', 'b')
  await repo.importMarkdownNotes([first, other], 'ask')
  await expect(
    repo.importMarkdownNotes([note('# Nova', 'c'), first], 'ask'),
  ).rejects.toThrow('duplicad')
  expect((await repo.snapshot()).notes.some((n) => n.id === 'c')).toBe(false)
  const ignored = await repo.importMarkdownNotes([first], 'ignore')
  expect(ignored.skipped).toBe(1)
  const copied = await repo.importMarkdownNotes([first], 'copy')
  expect(copied.imported[0]?.id).not.toBe(first.id)
  const before = await repo.snapshot()
  await repo.clearAll()
  await repo.importData(parseImport(encodeBackup(before), 'atlas.json'))
  expect((await repo.snapshot()).notes).toEqual(
    before.notes.map((note) => ({ ...note, isExample: false })),
  )
})
it('reimporta um backup JSON maior que 5 MB sem reduzir o limite de Markdown legado', async () => {
  const large = Array.from({ length: 12 }, (_, i) =>
    note(`# Nota ${i}\n${'a'.repeat(480_000)}`, `large-${i}`),
  )
  await repo.importMarkdownNotes(large, 'ask')
  const before = await repo.snapshot(),
    backup = encodeBackup(before)
  expect(new TextEncoder().encode(backup).byteLength).toBeGreaterThan(
    maxImportBytes,
  )
  await repo.clearAll()
  await repo.importData(parseImport(backup, 'atlas.json'))
  expect((await repo.snapshot()).notes).toEqual(
    before.notes.map((note) => ({ ...note, isExample: false })),
  )
  expect(() => parseImport(backup, 'atlas.md')).toThrow('5 MB')
})
