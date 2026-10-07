import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DexieAtlasRepository } from './dexie-repository'
import { createDatabase } from '../database'
import { buildSeed } from '../seed'
import { emptySnapshot, type Note, type Snapshot } from '../models'
import { recordCount, validateSnapshot } from '../../lib/data-integrity'
import { encodeBackup, encodeMarkdown, parseImport } from '../../lib/transfer'

let repository: DexieAtlasRepository
beforeEach(() => {
  repository = new DexieAtlasRepository(
    createDatabase(`atlas-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  await repository.database.delete()
})
const note = (id = 'personal'): Note => ({
  id,
  title: 'Minha nota',
  content: '# Conteúdo pessoal',
  tags: ['pessoal'],
  links: [],
  isExample: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('repository IndexedDB', () => {
  it.each(['json', 'md'])(
    'restaura todos os campos após exportar %s e esvaziar o banco inteiro',
    async (format) => {
      // Separate, randomly named database: never touches the user's atlas-local.
      await repository.importData(buildSeed(new Date('2026-09-30T12:00:00Z')))
      const before = await repository.snapshot()
      const text =
        format === 'json' ? encodeBackup(before) : encodeMarkdown(before)
      await repository.database.transaction(
        'rw',
        repository.database.tables,
        async () => {
          for (const table of repository.database.tables) await table.clear()
        },
      )
      expect(await repository.snapshot()).toEqual(emptySnapshot())
      expect(
        (await repository.importData(parseImport(text, `backup.${format}`)))
          .added,
      ).toBe(20) // 15 core records plus 2 subjects and 3 study paths.
      expect(await repository.snapshot()).toEqual(before)
      repository.database.close()
      await repository.database.open()
      await repository.initialize()
      expect(await repository.snapshot()).toEqual(before)
    },
  )
  it('inicializa exatamente uma vez mesmo em chamadas concorrentes e reabertura', async () => {
    await Promise.all([repository.initialize(), repository.initialize()])
    expect(recordCount(await repository.snapshot())).toBe(20)
    repository.database.close()
    await repository.database.open()
    await repository.initialize()
    expect(recordCount(await repository.snapshot())).toBe(20)
  })
  it('faz CRUD persistente, preserva createdAt e protege um exemplo editado', async () => {
    await repository.initialize()
    const created = await repository.save('notes', note())
    expect(await repository.get('notes', created.id)).toEqual(created)
    await repository.save('notes', {
      ...created,
      content: 'Alteração',
      createdAt: '2020-01-01T00:00:00Z',
    })
    expect((await repository.get('notes', created.id))?.createdAt).toBe(
      created.createdAt,
    )
    const example = (await repository.list('notes'))[0]!
    await repository.save('notes', { ...example, title: 'Agora é minha' })
    expect((await repository.get('notes', example.id))?.isExample).toBe(false)
    await repository.remove('notes', created.id)
    expect(await repository.get('notes', created.id)).toBeUndefined()
  })
  it('remove exemplos, mantém dados pessoais e desfaz após reabrir', async () => {
    await repository.initialize()
    await repository.save('notes', note())
    expect(recordCount(await repository.removeExamples())).toBe(20)
    expect(recordCount(await repository.snapshot())).toBe(1)
    repository.database.close()
    await repository.database.open()
    await repository.initialize()
    expect(recordCount(await repository.snapshot())).toBe(1)
    expect(await repository.canUndoExamples()).toBe(true)
    expect((await repository.undoRemoveExamples()).added).toBe(20)
    expect(recordCount(await repository.snapshot())).toBe(21)
    expect(await repository.canUndoExamples()).toBe(false)
  })
  it('protege vínculos pessoais e bloqueia exclusão que geraria órfãos', async () => {
    await repository.initialize()
    await repository.save('notes', {
      ...note(),
      links: [{ type: 'habits', id: 'example-habit-0' }],
    })
    await repository.removeExamples()
    expect(await repository.get('habits', 'example-habit-0')).toBeDefined()
    await expect(
      repository.remove('habits', 'example-habit-0'),
    ).rejects.toThrow(/vínculos/)
    await repository.undoRemoveExamples()
    expect(recordCount(validateSnapshot(await repository.snapshot()))).toBe(21)
  })
  it('importa sem duplicar, nunca sobrescreve e mantém vínculos', async () => {
    await repository.initialize()
    await repository.removeExamples()
    const first = await repository.importData(buildSeed())
    expect(first.added).toBe(20)
    const saved = (await repository.get('notes', 'example-note-0'))!
    await repository.save('notes', { ...saved, content: 'Edição local' })
    const second = await repository.importData(buildSeed())
    expect(second.added).toBe(0)
    expect((await repository.get('notes', saved.id))?.content).toBe(
      'Edição local',
    )
    expect(recordCount(await repository.removeExamples())).toBe(0)
  })
  it('aborta um import inválido sem tocar nos dados existentes', async () => {
    await repository.initialize()
    const before = await repository.snapshot()
    const invalid = buildSeed()
    invalid.habitLogs[0]!.habitId = 'missing'
    await expect(repository.importData(invalid)).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(before)
  })
  it('reverte toda a transação se a escrita falhar no meio da importação', async () => {
    await repository.initialize()
    const before = await repository.snapshot()
    const incoming = emptySnapshot()
    incoming.notes.push(note())
    const spy = vi
      .spyOn(repository.database.table('notes'), 'bulkPut')
      .mockRejectedValueOnce(new Error('Falha simulada'))
    await expect(repository.importData(incoming)).rejects.toThrow(
      'Falha simulada',
    )
    spy.mockRestore()
    expect(await repository.snapshot()).toEqual(before)
  })
  it('serializa duas importações concorrentes sem perder conteúdo', async () => {
    await repository.initialize()
    const a = emptySnapshot()
    a.notes.push(note('a'))
    const b = emptySnapshot()
    b.notes.push(note('b'))
    await Promise.all([repository.importData(a), repository.importData(b)])
    expect(await repository.get('notes', 'a')).toBeDefined()
    expect(await repository.get('notes', 'b')).toBeDefined()
  })
  it('notifica assinantes após salvar', async () => {
    await repository.initialize()
    const listener = vi.fn<(data: Snapshot) => void>()
    const errors = vi.fn()
    const stop = repository.subscribe(listener, errors)
    await repository.save('notes', note())
    await vi.waitFor(() =>
      expect(recordCount(listener.mock.lastCall?.[0] ?? emptySnapshot())).toBe(
        21,
      ),
    )
    expect(errors).not.toHaveBeenCalled()
    stop()
  })
})
