import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { type Note, type Task } from '../models'
import { DexieAtlasRepository } from './dexie-repository'
import {
  LumenAtlasRepository,
  lumenHistoryKey,
  type LumenHistory,
} from './lumen-atlas-repository'
import { decodeLumenPackage } from '../../lib/lumen-atlas/package'
import { comparisonHash, utf8 } from '../../lib/lumen-atlas/hashes'
import {
  changedPackage,
  id,
  sampleText,
  setupCrypto,
} from '../../lib/lumen-atlas/test-fixtures'
import { decodeBackup, encodeBackup } from '../../lib/transfer'

let repo: LumenAtlasRepository
let ordinary: DexieAtlasRepository
let draftIds: string[]
let draftChecked: boolean
const task: Task = {
  id: 'fictional-task',
  title: 'Fictional task',
  tags: [],
  links: [],
  isExample: false,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  status: 'todo',
  priority: 'low',
  dueDate: null,
  dueTime: null,
  context: null,
  subtasks: [],
  repeat: null,
  focusMinutes: 0,
}
beforeEach(() => {
  setupCrypto()
  draftIds = []
  draftChecked = true
  const database = createDatabase(
    'atlas-lumen-transfer-test-' + crypto.randomUUID(),
  )
  ordinary = new DexieAtlasRepository(database)
  repo = new LumenAtlasRepository(database, () => ({
    checked: draftChecked,
    ids: draftIds,
  }))
})
afterEach(async () => {
  vi.restoreAllMocks()
  await repo.database.delete()
  vi.unstubAllGlobals()
})
const history = async () =>
  (await repo.database
    .table<{ key: string; value: LumenHistory }, string>('meta')
    .get(lumenHistoryKey))!
async function create() {
  const plan = await repo.plan(utf8(sampleText))
  return repo.execute(plan, { confirmed: true })
}
async function updateBytes(text = 'Updated fictional body') {
  const current = await ordinary.get('notes', id)
  const baseline = await comparisonHash(
    current!.title,
    current!.tags,
    current!.content,
  )
  return changedPackage({ text, baseline, tags: ['updated'] })
}
async function databaseState() {
  return Promise.all(
    repo.database.tables.map(async (table) => [
      table.name,
      await table.toArray(),
    ]),
  )
}
describe('dedicated one-note transaction', () => {
  it('creates only one note/history entry, retains raw Markdown, and grants no activity/XP', async () => {
    const before = await ordinary.snapshot()
    const result = await create()
    const pkg = await decodeLumenPackage(utf8(sampleText))
    expect(result.outcome).toBe('created')
    expect(result.saved.id).toBe(id)
    expect(result.saved.content).toBe(pkg.markdown)
    expect(await ordinary.snapshot()).toEqual({
      ...before,
      notes: [result.saved],
    })
    const record = await history()
    expect(record.value.operations[0]).toMatchObject({
      before: null,
      after: result.saved,
      operation_id: result.operationId,
      kind: 'create',
      source_sha256: pkg.source_sha256,
    })
    expect(record.value.operations[0]).not.toHaveProperty('delivery')
  })
  it('reimports identical data with zero writes and identical timestamps/history', async () => {
    const initial = await create()
    const before = await databaseState()
    const notesPut = vi.spyOn(repo.database.table('notes'), 'put')
    const notesAdd = vi.spyOn(repo.database.table('notes'), 'add')
    const metaPut = vi.spyOn(repo.database.table('meta'), 'put')
    const result = await repo.execute(await repo.plan(utf8(sampleText)), {
      confirmed: true,
    })
    expect(result).toEqual({
      outcome: 'identical',
      integrationId: id,
      operationId: null,
      saved: initial.saved,
    })
    expect(notesPut).not.toHaveBeenCalled()
    expect(notesAdd).not.toHaveBeenCalled()
    expect(metaPut).not.toHaveBeenCalled()
    expect(await databaseState()).toEqual(before)
  })
  it('updates only tags/content/timestamp, preserving local fields, other entities and undo history', async () => {
    await create()
    await repo.database.table('tasks').add(task)
    const current = (await ordinary.get('notes', id))!
    const linked = {
      ...current,
      links: [{ type: 'tasks' as const, id: task.id }],
      isExample: true,
      archivedAt: '2026-10-10T12:00:00Z',
    }
    await repo.database.table('notes').put(linked)
    const other: Note = {
      ...current,
      id: 'unrelated',
      title: 'Unrelated',
      content: 'See [[Fictional Atlas transfer]].',
    }
    await repo.database.table('notes').add(other)
    const oldUndo = {
      key: 'noteHistory',
      value: [{ before: other, after: null }],
    }
    await repo.database.table('meta').put(oldUndo)
    const before = await ordinary.snapshot()
    const plan = await repo.plan(await updateBytes())
    expect(plan.operation).toBe('update')
    expect(plan.changedFields).toEqual(['tags', 'content'])
    const result = await repo.execute(plan, { confirmed: true })
    expect(result.outcome).toBe('updated')
    expect(result.saved).toMatchObject({
      id,
      createdAt: linked.createdAt,
      links: linked.links,
      archivedAt: linked.archivedAt,
      isExample: true,
      title: linked.title,
    })
    expect(Date.parse(result.saved.updatedAt)).toBeGreaterThan(
      Date.parse(linked.updatedAt),
    )
    expect(await ordinary.snapshot()).toEqual({
      ...before,
      notes: before.notes.map((note) => (note.id === id ? result.saved : note)),
    })
    expect(await repo.database.table('meta').get('noteHistory')).toEqual(
      oldUndo,
    )
  })
  it('requires explicit confirmation and a genuine frozen plan', async () => {
    const plan = await repo.plan(utf8(sampleText))
    const before = await databaseState()
    for (const confirmed of [false, 'true', 1])
      await expect(
        repo.execute(plan, { confirmed: confirmed as boolean }),
      ).rejects.toThrow('confirmation_required')
    await expect(
      repo.execute({ ...plan }, { confirmed: true }),
    ).rejects.toThrow('unvalidated_plan')
    expect(await databaseState()).toEqual(before)
  })
  it.each([
    'timestamp',
    'content',
    'archive',
    'relations',
    'candidate',
  ] as const)('invalidates %s changes after planning', async (field) => {
    await create()
    await repo.database.table('tasks').add(task)
    const plan = await repo.plan(await updateBytes())
    const current = (await ordinary.get('notes', id))!
    if (field === 'candidate')
      await repo.database.table('notes').add({ ...current, id: 'other' })
    else
      await repo.database
        .table('notes')
        .put({
          ...current,
          ...(field === 'timestamp'
            ? { updatedAt: '2099-01-01T00:00:00Z' }
            : {}),
          ...(field === 'content' ? { content: 'Local edit' } : {}),
          ...(field === 'archive'
            ? { archivedAt: '2026-10-10T12:00:00Z' }
            : {}),
          ...(field === 'relations'
            ? { links: [{ type: 'tasks', id: task.id }] }
            : {}),
        })
    const before = await databaseState()
    await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
      'plan_stale',
    )
    expect(await databaseState()).toEqual(before)
  })
  it('blocks drafts and unknown checks; a new draft invalidates a prepared operation', async () => {
    const bytes = utf8(sampleText)
    draftChecked = false
    expect((await repo.plan(bytes)).conflicts).toContain('draft_state_unknown')
    draftChecked = true
    const plan = await repo.plan(bytes)
    draftIds = [id]
    expect((await repo.plan(bytes)).conflicts).toContain('draft_exists')
    await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
      'plan_stale',
    )
    expect((await ordinary.snapshot()).notes).toEqual([])
    expect(draftIds).toEqual([id])
  })
  it('keeps injected fictional draft storage untouched', async () => {
    localStorage.setItem('fictional-lumen-drafts', '{"other":"draft"}')
    await create()
    await repo.execute(await repo.plan(await updateBytes()), {
      confirmed: true,
    })
    expect(localStorage.getItem('fictional-lumen-drafts')).toBe(
      '{"other":"draft"}',
    )
    localStorage.removeItem('fictional-lumen-drafts')
  })
  it('serializes concurrent operations from two isolated connections; only one wins', async () => {
    await create()
    const first = await repo.plan(await updateBytes('First contender'))
    const second = await repo.plan(await updateBytes('Second contender'))
    const database = createDatabase(repo.database.name)
    const other = new LumenAtlasRepository(database, () => ({
      checked: true,
      ids: [],
    }))
    try {
      const results = await Promise.allSettled([
        repo.execute(first, { confirmed: true }),
        other.execute(second, { confirmed: true }),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1)
      expect((await history()).value.operations).toHaveLength(2)
    } finally {
      database.close()
    }
  })
  it.each(['create', 'update'] as const)(
    'rolls back %s if history cannot be written, without leaking the underlying error',
    async (operation) => {
      if (operation === 'update') await create()
      const plan = await repo.plan(
        operation === 'create' ? utf8(sampleText) : await updateBytes(),
      )
      const before = await databaseState()
      vi.spyOn(repo.database.table('meta'), 'put').mockRejectedValueOnce(
        new Error('FICTIONAL_PRIVATE_CONTENT'),
      )
      await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
        'repository_write_failed',
      )
      expect(await databaseState()).toEqual(before)
    },
  )
  it('blocks untrusted recovery state and does not reset it', async () => {
    await repo.database
      .table('meta')
      .put({ key: lumenHistoryKey, value: { version: 99 } })
    const before = await databaseState()
    const plan = await repo.plan(utf8(sampleText))
    expect(plan.conflicts).toContain('recovery_unavailable')
    await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
      'import_conflict',
    )
    expect(await databaseState()).toEqual(before)
  })
  it('blocks global-ID collision, missing update targets and candidates under another ID', async () => {
    await repo.database.table('tasks').add({ ...task, id })
    expect((await repo.plan(utf8(sampleText))).conflicts).toContain(
      'identity_in_other_collection',
    )
    await repo.database.table('tasks').clear()
    await create()
    const bytes = await updateBytes()
    await repo.database.table('notes').delete(id)
    expect((await repo.plan(bytes)).conflicts).toContain(
      'update_target_missing',
    )
    expect((await repo.plan(utf8(sampleText))).conflicts).toContain(
      'update_target_missing',
    )
  })
  it('does not let a prepared-but-undelivered baseline overwrite the current note', async () => {
    await create()
    const unreceived = await decodeLumenPackage(
      await changedPackage({ text: 'Never imported version' }),
    )
    const plan = await repo.plan(
      await changedPackage({
        text: 'Later version',
        baseline: unreceived.comparison_sha256,
      }),
    )
    expect(plan.conflicts).toContain('baseline_mismatch')
    const before = await databaseState()
    await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
      'import_conflict',
    )
    expect(await databaseState()).toEqual(before)
  })
})
describe('approved local recovery and retention', () => {
  it('recovers a previous version after reopen, preserving its fields with a fresh revision timestamp', async () => {
    const original = await create()
    const updated = await repo.execute(await repo.plan(await updateBytes()), {
      confirmed: true,
    })
    repo.database.close()
    await repo.database.open()
    const plan = await repo.planRestore(updated.operationId!)
    await expect(repo.restore(plan, { confirmed: false })).rejects.toThrow(
      'confirmation_required',
    )
    const restored = await repo.restore(plan, { confirmed: true })
    expect(restored).toEqual({
      ...original.saved,
      updatedAt: restored.updatedAt,
    })
    expect(Date.parse(restored.updatedAt)).toBeGreaterThan(
      Date.parse(updated.saved.updatedAt),
    )
    expect(await ordinary.get('notes', id)).toEqual(restored)
    expect((await history()).value.operations[1]).toMatchObject({
      before: original.saved,
      after: updated.saved,
      restored_record_sha256: expect.any(String),
      restored_at: expect.any(String),
    })
    await expect(repo.planRestore(updated.operationId!)).rejects.toThrow(
      'recovery_not_available',
    )
    await expect(
      ordinary.saveNote(
        { ...updated.saved, content: 'Stale draft' },
        updated.saved.updatedAt,
      ),
    ).rejects.toThrow(/outra aba/)
  })
  it('refuses to recover creation by deleting a note', async () => {
    const result = await create()
    await expect(repo.planRestore(result.operationId!)).rejects.toThrow(
      'recovery_not_available',
    )
    expect((await ordinary.snapshot()).notes).toHaveLength(1)
  })
  it.each(['edit', 'draft', 'tamper'] as const)(
    'blocks %s during recovery without overwriting anything',
    async (change) => {
      await create()
      const updated = await repo.execute(await repo.plan(await updateBytes()), {
        confirmed: true,
      })
      const plan = await repo.planRestore(updated.operationId!)
      if (change === 'edit')
        await repo.database
          .table('notes')
          .put({ ...updated.saved, content: 'Local content' })
      if (change === 'draft') draftIds = [id]
      if (change === 'tamper') {
        const record = await history()
        record.value.operations[1]!.before!.content =
          'Tampered previous version'
        await repo.database.table('meta').put(record)
      }
      const before = await databaseState()
      await expect(repo.restore(plan, { confirmed: true })).rejects.toThrow()
      expect(await databaseState()).toEqual(before)
    },
  )
  it('rolls back restore when recovery bookkeeping fails', async () => {
    await create()
    const updated = await repo.execute(await repo.plan(await updateBytes()), {
      confirmed: true,
    })
    const plan = await repo.planRestore(updated.operationId!)
    const before = await databaseState()
    vi.spyOn(repo.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('FICTIONAL_PRIVATE_CONTENT'),
    )
    await expect(repo.restore(plan, { confirmed: true })).rejects.toThrow(
      'recovery_write_failed',
    )
    expect(await databaseState()).toEqual(before)
  })
  it('caps operations at 100, retains every entry, and permits a write-free identical import', async () => {
    await create()
    const record = await history()
    const first = record.value.operations[0]!
    record.value.operations = Array.from({ length: 100 }, () => ({
      ...first,
      operation_id: crypto.randomUUID(),
    }))
    await repo.database.table('meta').put(record)
    const before = await databaseState()
    expect((await repo.plan(await updateBytes())).conflicts).toContain(
      'recovery_capacity',
    )
    expect(
      (
        await repo.execute(await repo.plan(utf8(sampleText)), {
          confirmed: true,
        })
      ).outcome,
    ).toBe('identical')
    expect(await databaseState()).toEqual(before)
  })
  it('rejects recovery history over 20 MiB without pruning', async () => {
    await create()
    const record = await history()
    const first = record.value.operations[0]!
    record.value.operations = Array.from({ length: 50 }, () => ({
      ...first,
      operation_id: crypto.randomUUID(),
      after: { ...first.after, content: 'x'.repeat(450_000) },
    }))
    await repo.database.table('meta').put(record)
    const before = await history()
    expect((await repo.plan(await updateBytes())).conflicts).toContain(
      'recovery_unavailable',
    )
    expect(await history()).toEqual(before)
  })
  it('existing backups keep note IDs/content but exclude recovery, leaving future updates blocked', async () => {
    await create()
    const data = await ordinary.snapshot()
    const backup = encodeBackup(data)
    expect(backup).not.toContain(lumenHistoryKey)
    expect(decodeBackup(backup).notes[0]?.id).toBe(id)
    const isolated = createDatabase(
      'atlas-lumen-backup-test-' + crypto.randomUUID(),
    )
    try {
      const restored = new DexieAtlasRepository(isolated)
      await restored.importData(decodeBackup(backup))
      const importer = new LumenAtlasRepository(isolated, () => ({
        checked: true,
        ids: [],
      }))
      expect((await importer.plan(await updateBytes())).conflicts).toContain(
        'identity_uncertain',
      )
    } finally {
      await isolated.delete()
    }
  })
  it('does not log note bodies or caught exception text', async () => {
    const log = vi.spyOn(console, 'log')
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')
    await create()
    await repo.execute(
      await repo.plan(await updateBytes('FICTIONAL_PRIVATE_CONTENT')),
      { confirmed: true },
    )
    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})

it('rejects raw local fields that a general schema would trim, preserving the stored bytes', async () => {
  await create()
  const bytes = await updateBytes()
  const current = (await ordinary.get('notes', id))!
  const malformed = { ...current, title: ' ' + current.title + ' ' }
  await repo.database.table('notes').put(malformed)
  await expect(repo.plan(bytes)).rejects.toThrow('invalid_local_note')
  expect(await ordinary.get('notes', id)).toEqual(malformed)
})
it('blocks corrupted hashes in recovery history before planning an update', async () => {
  await create()
  const bytes = await updateBytes()
  const record = await history()
  record.value.operations[0]!.after_record_sha256 = '0'.repeat(64)
  await repo.database.table('meta').put(record)
  const before = await databaseState()
  expect((await repo.plan(bytes)).conflicts).toContain('recovery_unavailable')
  expect(await databaseState()).toEqual(before)
})
it('rejects an update exceeding the byte cap before any note write', async () => {
  await create()
  const record = await history()
  const first = record.value.operations[0]!
  const large = { ...first.after, content: 'x'.repeat(500_000) }
  const largeHash = await comparisonHash(large.title, large.tags, large.content)
  const { recordHash, sha256 } = await import('../../lib/lumen-atlas/hashes')
  const afterHash = await recordHash(large)
  const sourceHash = await sha256(utf8(large.content))
  record.value.operations = Array.from({ length: 41 }, () => ({
    ...first,
    operation_id: crypto.randomUUID(),
    after: large,
    comparison_sha256: largeHash,
    source_sha256: sourceHash,
    after_record_sha256: afterHash,
  }))
  await repo.database.table('meta').put(record)
  const plan = await repo.plan(await updateBytes('x'.repeat(499_000)))
  expect(plan.operation).toBe('update')
  const beforeNote = await ordinary.get('notes', id)
  const beforeHistory = await history()
  await expect(repo.execute(plan, { confirmed: true })).rejects.toThrow(
    'recovery_capacity',
  )
  expect(await ordinary.get('notes', id)).toEqual(beforeNote)
  expect(await history()).toEqual(beforeHistory)
})
it('preserves all unrelated records during one-note restoration', async () => {
  await create()
  await repo.database.table('tasks').add(task)
  const current = (await ordinary.get('notes', id))!
  await repo.database
    .table('notes')
    .add({
      ...current,
      id: 'other-note',
      title: 'Other note',
      content: 'Unchanged.',
    })
  const updated = await repo.execute(await repo.plan(await updateBytes()), {
    confirmed: true,
  })
  const before = await ordinary.snapshot()
  const restored = await repo.restore(
    await repo.planRestore(updated.operationId!),
    { confirmed: true },
  )
  expect(await ordinary.snapshot()).toEqual({
    ...before,
    notes: before.notes.map((note) => (note.id === id ? restored : note)),
  })
})
it('does not fetch or execute embedded resources during the complete fictional flow', async () => {
  const fetch = vi.fn(() => {
    throw new Error('Network access forbidden')
  })
  vi.stubGlobal('fetch', fetch)
  const bytes = await changedPackage({
    text: '<script>fetch("https://example.invalid")</script>\n![[image]]\n[[path|alias]]',
  })
  const pkg = await decodeLumenPackage(bytes)
  const result = await repo.execute(await repo.plan(bytes), { confirmed: true })
  expect(result.saved.content).toBe(pkg.markdown)
  expect(fetch).not.toHaveBeenCalled()
})

it('reconstructs exact UTF-8 source bytes after an isolated BOM/CRLF/Unicode import', async () => {
  const bytes = await changedPackage({
    bom: true,
    crlf: true,
    title: 'Unicode A\u0301 \ud83d\ude00',
  })
  const pkg = await decodeLumenPackage(bytes)
  const result = await repo.execute(await repo.plan(bytes), { confirmed: true })
  const stored = (await ordinary.get('notes', result.integrationId))!
  const { sha256 } = await import('../../lib/lumen-atlas/hashes')
  expect(stored.content).toBe(pkg.markdown)
  expect(stored.content.startsWith('\ufeff---\r\n')).toBe(true)
  expect(await sha256(utf8(stored.content))).toBe(pkg.source_sha256)
})
