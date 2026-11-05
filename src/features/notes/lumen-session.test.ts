import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDatabase } from '../../data/database'
import { DexieAtlasRepository } from '../../data/repositories/dexie-repository'
import {
  LumenAtlasRepository,
  lumenHistoryKey,
} from '../../data/repositories/lumen-atlas-repository'
import {
  changedPackage,
  setupCrypto,
  id,
} from '../../lib/lumen-atlas/test-fixtures'
import { decodeLumenPackage } from '../../lib/lumen-atlas/package'
import { LumenTransferSession, type PackageFile } from './lumen-session'
import {
  readLumenDraftStatus,
  useDrafts,
  noteDraftStorageKey,
} from './draft-store'

const database = createDatabase('lumen-ui-tests-' + Math.random())
const repository = new DexieAtlasRepository(database)
const transfer = new LumenAtlasRepository(database, readLumenDraftStatus)
let session: LumenTransferSession
function file(bytes: Uint8Array): PackageFile {
  return {
    name: 'fictional.lumen-atlas.json',
    size: bytes.length,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  }
}
async function apply(bytes: Uint8Array) {
  await session.select(file(bytes))
  expect(session.getSnapshot().plan?.operation).not.toBe('conflict')
  session.review()
  await session.confirm()
  expect(session.getSnapshot().error).toBeNull()
}
beforeEach(async () => {
  setupCrypto()
  await database.open()
  for (const table of database.tables) await table.clear()
  localStorage.clear()
  useDrafts.setState({ drafts: {}, error: false })
  session = new LumenTransferSession(transfer, repository)
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  useDrafts.setState({ drafts: {}, error: false })
  await database.close()
})
it('requires explicit confirmation; cancellation never writes', async () => {
  await session.select(file(await changedPackage()))
  expect(session.getSnapshot().phase).toBe('preview')
  await session.confirm()
  expect(await database.table('notes').count()).toBe(0)
  session.review()
  session.cancel()
  await session.confirm()
  expect(await database.table('meta').count()).toBe(0)
  expect(await database.table('notes').count()).toBe(0)
  expect(session.getSnapshot().message).toContain('cancelada')
})
it('creates once and identical reimport never writes or changes timestamps/history', async () => {
  const bytes = await changedPackage()
  await apply(bytes)
  const before = await repository.snapshot()
  const history = await transfer.operations()
  const put = vi.spyOn(database.table('notes'), 'put')
  await apply(bytes)
  expect(session.getSnapshot().message).toContain('idêntica')
  expect(await repository.snapshot()).toEqual(before)
  expect(await transfer.operations()).toEqual(history)
  expect(put).not.toHaveBeenCalled()
})
it('updates only tags/content and preserves unrelated collections and metadata', async () => {
  const bytes = await changedPackage()
  await apply(bytes)
  await database
    .table('meta')
    .put({ key: 'unrelated', value: { fictional: true } })
  const before = await repository.snapshot()
  const pkg = await decodeLumenPackage(bytes)
  await apply(
    await changedPackage({
      text: 'New fictional revision',
      tags: ['lumen', 'fictional'],
      baseline: pkg.comparison_sha256,
    }),
  )
  const after = await repository.snapshot()
  expect(after.notes[0]!.content).toContain('New fictional revision')
  expect({ ...after, notes: [] }).toEqual({ ...before, notes: [] })
  expect(after.notes[0]!.title).toBe(before.notes[0]!.title)
  expect(after.notes[0]!.links).toEqual(before.notes[0]!.links)
  expect((await database.table('meta').get('unrelated')).value).toEqual({
    fictional: true,
  })
})
it('shows local conflicts, title restrictions and insufficient identity without force actions', async () => {
  const bytes = await changedPackage()
  await apply(bytes)
  const pkg = await decodeLumenPackage(bytes)
  const current = await database.table('notes').get(id)
  await database
    .table('notes')
    .put({ ...current, content: 'Local fictional edit' })
  await session.select(
    file(
      await changedPackage({
        text: 'Remote edit',
        baseline: pkg.comparison_sha256,
      }),
    ),
  )
  expect(session.getSnapshot().plan?.conflicts).toContain('baseline_mismatch')
  session.review()
  await session.confirm()
  expect((await database.table('notes').get(id)).content).toBe(
    'Local fictional edit',
  )
  await database.table('meta').delete(lumenHistoryKey)
  await session.select(file(bytes))
  expect(session.getSnapshot().plan?.conflicts).toContain('identity_uncertain')
})
it('blocks real in-memory and persisted drafts, including unavailable checks', async () => {
  const bytes = await changedPackage()
  await apply(bytes)
  const pkg = await decodeLumenPackage(bytes)
  const update = await changedPackage({
    text: 'Next revision',
    baseline: pkg.comparison_sha256,
  })
  const draft = {
    title: 'Draft',
    content: 'Unsaved fictional edit',
    tags: '',
    basedOn: 'before',
  }
  localStorage.setItem(noteDraftStorageKey, JSON.stringify({ [id]: draft }))
  await session.select(file(update))
  expect(session.getSnapshot().plan?.conflicts).toContain('draft_exists')
  expect(localStorage.getItem(noteDraftStorageKey)).toContain('Unsaved')
  localStorage.removeItem(noteDraftStorageKey)
  useDrafts.setState({ drafts: { [id]: draft } })
  await session.select(file(update))
  expect(session.getSnapshot().plan?.conflicts).toContain('draft_exists')
  useDrafts.setState({ drafts: {} })
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw Error('private')
  })
  await session.select(file(update))
  expect(session.getSnapshot().plan?.conflicts).toContain('draft_state_unknown')
  read.mockRestore()
})
it('rechecks drafts and local note immediately before execution', async () => {
  const bytes = await changedPackage()
  await session.select(file(bytes))
  session.review()
  useDrafts.setState({ error: true })
  await session.confirm()
  expect(session.getSnapshot().error).toBe('plan_stale')
  expect(await database.table('notes').count()).toBe(0)
})
it('invalidates confirmation when package file changes after preview', async () => {
  const before = await changedPackage()
  const after = await changedPackage({ text: 'Replaced file' })
  let selected = before
  await session.select({
    ...file(before),
    arrayBuffer: async () => new Uint8Array(selected).buffer,
  })
  session.review()
  selected = after
  await session.confirm()
  expect(session.getSnapshot().error).toBe('package_changed')
  expect(await database.table('notes').count()).toBe(0)
})
it('invalidation prevents a stale confirmation and late read completion', async () => {
  const bytes = await changedPackage()
  await session.select(file(bytes))
  session.review()
  session.invalidate()
  await session.confirm()
  expect(await database.table('notes').count()).toBe(0)
  let release!: (data: ArrayBuffer) => void
  const pending = session.select({
    ...file(bytes),
    arrayBuffer: () =>
      new Promise((resolve) => {
        release = resolve
      }),
  })
  session.cancel()
  release(new Uint8Array(bytes).buffer)
  await pending
  expect(session.getSnapshot().phase).toBe('result')
  expect(session.getSnapshot().plan).toBeNull()
})
it('validates and restores only the selected previous version with explicit confirmation', async () => {
  const first = await changedPackage()
  await apply(first)
  const original = await database.table('notes').get(id)
  const pkg = await decodeLumenPackage(first)
  await apply(
    await changedPackage({
      text: 'Second revision',
      baseline: pkg.comparison_sha256,
    }),
  )
  await session.loadHistory()
  expect(session.getSnapshot().history).toHaveLength(2)
  const operation = session
    .getSnapshot()
    .history.find((o) => o.kind === 'update')!
  await session.selectRestore(operation.operation_id)
  expect(session.getSnapshot().restore?.before.content).toBe(original.content)
  await session.confirmRestore()
  expect((await database.table('notes').get(id)).content).not.toBe(
    original.content,
  )
  session.reviewRestore()
  await session.confirmRestore()
  expect(session.getSnapshot().error).toBeNull()
  expect((await database.table('notes').get(id)).content).toBe(original.content)
  expect((await transfer.operations())[1]!.restored_at).not.toBeNull()
})
it('restoration is blocked if note or draft changes after preview', async () => {
  const first = await changedPackage()
  await apply(first)
  await apply(
    await changedPackage({
      text: 'Second',
      baseline: (await decodeLumenPackage(first)).comparison_sha256,
    }),
  )
  const operation = (await transfer.operations())[1]!
  await session.selectRestore(operation.operation_id)
  session.reviewRestore()
  const note = await database.table('notes').get(id)
  await database.table('notes').put({ ...note, content: 'New local edit' })
  await session.confirmRestore()
  expect(session.getSnapshot().error).toBe('recovery_conflict')
  expect((await database.table('notes').get(id)).content).toBe('New local edit')
})
it('blocks writes at recovery capacity, exposes no cleanup', async () => {
  await apply(await changedPackage())
  const entry = (await transfer.operations())[0]!
  await database
    .table('meta')
    .put({
      key: lumenHistoryKey,
      value: {
        version: 1,
        operations: Array.from({ length: 100 }, () => ({
          ...entry,
          operation_id: crypto.randomUUID(),
        })),
      },
    })
  await session.select(
    file(
      await changedPackage({
        id: 'lumen_' + 'b'.repeat(32),
        title: 'Other fictional note',
      }),
    ),
  )
  expect(session.getSnapshot().plan?.conflicts).toContain('recovery_capacity')
  expect(await database.table('notes').count()).toBe(1)
  expect(await transfer.operations()).toHaveLength(100)
})
it('rejects invalid input without copying parser excerpts into result', async () => {
  const bytes = new TextEncoder().encode(
    '{"secret":"FICTIONAL PRIVATE CONTENT"}',
  )
  await session.select(file(bytes))
  expect(session.getSnapshot().plan).toBeNull()
  expect(session.getSnapshot().error).not.toContain('PRIVATE')
  expect(session.getSnapshot().message).not.toContain('PRIVATE')
})
