import Dexie from 'dexie'
import { z } from 'zod'
import { noteSchema, type Note, type Snapshot } from '../models'
import { DexieAtlasRepository } from './dexie-repository'
import { fail, LumenTransferError } from '../../lib/lumen-atlas/errors'
import { decodeLumenPackage, hexHash } from '../../lib/lumen-atlas/package'
import {
  comparisonHash,
  recordHash,
  sha256,
  utf8,
} from '../../lib/lumen-atlas/hashes'
import {
  assertPlan,
  planLumenImport,
  type DraftStatus,
  type LumenImportPlan,
} from '../../lib/lumen-atlas/plan'

export const lumenHistoryKey = 'lumenTransferHistory.v1'
export const maxLumenOperations = 100
export const maxLumenHistoryBytes = 20 * 1024 * 1024
const exactNoteSchema = z.custom<Note>((value) => {
  const result = noteSchema.safeParse(value)
  if (!result.success) return false
  const original = value as Note
  return (
    original.title === result.data.title &&
    original.tags.every((tag, i) => tag === result.data.tags[i])
  )
})
const entrySchema = z
  .object({
    operation_id: z.uuid(),
    kind: z.enum(['create', 'update']),
    integration_id: z.string().regex(/^lumen_[0-9a-f]{32}$/u),
    package_sha256: hexHash,
    source_sha256: hexHash,
    comparison_sha256: hexHash,
    baseline_sha256: hexHash.nullable(),
    before: exactNoteSchema.nullable(),
    after: exactNoteSchema,
    before_record_sha256: hexHash,
    after_record_sha256: hexHash,
    applied_at: z.iso.datetime(),
    restored_at: z.iso.datetime().nullable(),
    restored_record_sha256: hexHash.nullable(),
  })
  .strict()
const historySchema = z
  .object({
    version: z.literal(1),
    operations: z.array(entrySchema).max(maxLumenOperations),
  })
  .strict()
type Entry = z.infer<typeof entrySchema>
export type LumenHistory = z.infer<typeof historySchema>
type History = z.infer<typeof historySchema>
export interface LumenImportResult {
  readonly outcome: 'created' | 'updated' | 'identical'
  readonly integrationId: string
  readonly operationId: string | null
  readonly saved: Note
}
export interface LumenRestorePlan {
  readonly operationId: string
  readonly integrationId: string
  readonly expectedRecordHash: string
  readonly before: Readonly<Note>
}
const restorations = new WeakSet<object>()
const timestamp = (note?: Note) =>
  new Date(
    Math.max(
      Date.now(),
      note ? Date.parse(note.updatedAt) + 1 : 0,
      note ? Date.parse(note.createdAt) : 0,
    ),
  ).toISOString()
const freezeNote = (note: Note) =>
  Object.freeze({
    ...note,
    tags: Object.freeze([...note.tags]) as unknown as string[],
    links: Object.freeze(
      note.links.map((link) => Object.freeze({ ...link })),
    ) as unknown as Note['links'],
  })

/** Explicit database injection. Never initializes seeds, opens a browser DB, or touches draft storage. */
export class LumenAtlasRepository {
  readonly database: Dexie
  private readonly draftStatus: () => DraftStatus
  constructor(
    database: Dexie,
    draftStatus: () => DraftStatus = () => ({ checked: false, ids: [] }),
  ) {
    this.database = database
    this.draftStatus = draftStatus
  }
  private meta() {
    return this.database.table<{ key: string; value: unknown }, string>('meta')
  }
  private async history(): Promise<History> {
    const record = await this.meta().get(lumenHistoryKey)
    if (!record) return { version: 1, operations: [] }
    const parsed = historySchema.safeParse(record.value)
    if (
      !parsed.success ||
      utf8(JSON.stringify(record.value)).length > maxLumenHistoryBytes
    )
      fail('recovery_unavailable')
    const history = parsed.data
    const ids = new Set<string>()
    for (const entry of history.operations) {
      if (
        ids.has(entry.operation_id) ||
        entry.after.id !== entry.integration_id ||
        (entry.before && entry.before.id !== entry.integration_id) ||
        (entry.kind === 'update') !== Boolean(entry.before) ||
        (entry.restored_at === null) !== (entry.restored_record_sha256 === null)
      )
        fail('recovery_unavailable')
      if (
        (await recordHash(entry.before)) !== entry.before_record_sha256 ||
        (await recordHash(entry.after)) !== entry.after_record_sha256 ||
        (await sha256(utf8(entry.after.content))) !== entry.source_sha256 ||
        (await comparisonHash(
          entry.after.title,
          entry.after.tags,
          entry.after.content,
        )) !== entry.comparison_sha256 ||
        (entry.before
          ? (await comparisonHash(
              entry.before.title,
              entry.before.tags,
              entry.before.content,
            )) !== entry.baseline_sha256
          : entry.baseline_sha256 !== null)
      )
        fail('recovery_unavailable')
      ids.add(entry.operation_id)
    }
    return history
  }
  private drafts(): DraftStatus {
    try {
      const status = this.draftStatus()
      if (
        status.checked !== true ||
        !Array.isArray(status.ids) ||
        status.ids.some((id) => typeof id !== 'string')
      )
        return { checked: false, ids: [] }
      return { checked: true, ids: [...status.ids] }
    } catch {
      return { checked: false, ids: [] }
    }
  }
  private requireClearDraft(id: string): void {
    const status = this.drafts()
    if (!status.checked || status.ids.includes(id)) fail('draft_state_changed')
  }
  private async snapshot() {
    const raw = await this.database.table<Note, string>('notes').toArray()
    if (raw.some((note) => !exactNoteSchema.safeParse(note).success))
      fail('invalid_local_note')
    return new DexieAtlasRepository(this.database).snapshot()
  }
  private async makePlan(
    pkg: LumenImportPlan['proposed'],
    data: Snapshot,
  ): Promise<LumenImportPlan> {
    let history: History
    try {
      history = await this.history()
    } catch {
      return planLumenImport(pkg, data, this.drafts(), {
        ready: false,
        knownIds: [],
        atCapacity: false,
      })
    }
    return planLumenImport(pkg, data, this.drafts(), {
      ready: true,
      knownIds: [
        ...new Set(history.operations.map((entry) => entry.integration_id)),
      ],
      atCapacity:
        history.operations.length >= maxLumenOperations ||
        utf8(JSON.stringify(history)).length >= maxLumenHistoryBytes,
    })
  }
  /** Read-only, verified recovery catalog for the UI; does not prune or alter history. */
  async operations(): Promise<LumenHistory['operations']> {
    return this.database.transaction('r', this.database.tables, async () => {
      const history = await Dexie.waitFor(this.history())
      return history.operations
    })
  }
  async plan(bytes: Uint8Array): Promise<LumenImportPlan> {
    const pkg = await decodeLumenPackage(bytes)
    return this.database.transaction('r', this.database.tables, async () =>
      Dexie.waitFor(this.makePlan(pkg, await this.snapshot())),
    )
  }
  async execute(
    plan: LumenImportPlan,
    confirmation: { confirmed: boolean },
  ): Promise<LumenImportResult> {
    assertPlan(plan)
    if (confirmation.confirmed !== true) fail('confirmation_required')
    if (plan.operation === 'conflict') fail('import_conflict')
    try {
      return await this.database.transaction(
        plan.operation === 'identical' ? 'r' : 'rw',
        this.database.tables,
        async () => {
          const data = await this.snapshot()
          const fresh = await Dexie.waitFor(this.makePlan(plan.proposed, data))
          if (
            fresh.operation !== plan.operation ||
            fresh.expectedRecordHash !== plan.expectedRecordHash ||
            fresh.expectedUpdatedAt !== plan.expectedUpdatedAt ||
            fresh.conflicts.length
          )
            fail('plan_stale')
          const before = data.notes.find(
            (note) => note.id === plan.integrationId,
          )
          if (plan.operation === 'identical')
            return {
              outcome: 'identical',
              integrationId: plan.integrationId,
              operationId: null,
              saved: before!,
            }
          this.requireClearDraft(plan.integrationId)
          const now = timestamp()
          const saved = noteSchema.parse(
            before
              ? {
                  ...before,
                  // Only transferred tags/content and the local revision timestamp change.
                  tags: [...plan.proposed.tags],
                  content: plan.proposed.markdown,
                  updatedAt: timestamp(before),
                }
              : {
                  id: plan.integrationId,
                  title: plan.proposed.title,
                  tags: [...plan.proposed.tags],
                  content: plan.proposed.markdown,
                  links: [],
                  isExample: false,
                  createdAt: now,
                  updatedAt: now,
                  archivedAt: null,
                },
          )
          const operationId = crypto.randomUUID()
          const entry: Entry = {
            operation_id: operationId,
            kind: before ? 'update' : 'create',
            integration_id: saved.id,
            package_sha256: plan.proposed.package_sha256,
            source_sha256: plan.proposed.source_sha256,
            comparison_sha256: plan.proposed.comparison_sha256,
            baseline_sha256: plan.proposed.baseline_sha256,
            before: before ?? null,
            after: saved,
            before_record_sha256: await Dexie.waitFor(
              recordHash(before ?? null),
            ),
            after_record_sha256: await Dexie.waitFor(recordHash(saved)),
            applied_at: new Date().toISOString(),
            restored_at: null,
            restored_record_sha256: null,
          }
          const history = await Dexie.waitFor(this.history())
          history.operations.push(entry)
          if (
            history.operations.length > maxLumenOperations ||
            utf8(JSON.stringify(history)).length +
              history.operations.filter(
                (item) => item.kind === 'update' && !item.restored_at,
              ).length *
                100 >
              maxLumenHistoryBytes
          )
            fail('recovery_capacity')
          this.requireClearDraft(plan.integrationId)
          if (before)
            await this.database.table<Note, string>('notes').put(saved)
          else await this.database.table<Note, string>('notes').add(saved)
          await this.meta().put({
            key: lumenHistoryKey,
            value: historySchema.parse(history),
          })
          return {
            outcome: before ? 'updated' : 'created',
            integrationId: saved.id,
            operationId,
            saved,
          }
        },
      )
    } catch (error) {
      if (error instanceof LumenTransferError) throw error
      return fail('repository_write_failed')
    }
  }
  async planRestore(operationId: string): Promise<LumenRestorePlan> {
    return this.database.transaction('r', this.database.tables, async () => {
      const history = await Dexie.waitFor(this.history())
      const entry = history.operations.find(
        (item) => item.operation_id === operationId,
      )
      if (!entry || !entry.before || entry.restored_at !== null)
        fail('recovery_not_available')
      const current = await this.database
        .table<Note, string>('notes')
        .get(entry.integration_id)
      if (
        (await Dexie.waitFor(recordHash(entry.before))) !==
          entry.before_record_sha256 ||
        (await Dexie.waitFor(recordHash(entry.after))) !==
          entry.after_record_sha256
      )
        fail('recovery_unavailable')
      const expected = await Dexie.waitFor(recordHash(current ?? null))
      if (expected !== entry.after_record_sha256) fail('recovery_conflict')
      const drafts = this.drafts()
      if (!drafts.checked || drafts.ids.includes(entry.integration_id))
        fail('draft_state_unknown_or_exists')
      const plan = Object.freeze({
        operationId,
        integrationId: entry.integration_id,
        expectedRecordHash: expected,
        before: freezeNote(entry.before),
      })
      restorations.add(plan)
      return plan
    })
  }
  async restore(
    plan: LumenRestorePlan,
    confirmation: { confirmed: boolean },
  ): Promise<Note> {
    if (!restorations.has(plan) || confirmation.confirmed !== true)
      fail('confirmation_required')
    try {
      return await this.database.transaction(
        'rw',
        this.database.tables,
        async () => {
          const history = await Dexie.waitFor(this.history())
          const entry = history.operations.find(
            (item) => item.operation_id === plan.operationId,
          )
          if (
            !entry?.before ||
            entry.restored_at !== null ||
            entry.integration_id !== plan.integrationId ||
            (await Dexie.waitFor(recordHash(entry.before))) !==
              entry.before_record_sha256 ||
            (await Dexie.waitFor(recordHash(plan.before))) !==
              entry.before_record_sha256
          )
            fail('recovery_unavailable')
          const current = await this.database
            .table<Note, string>('notes')
            .get(plan.integrationId)
          if (
            !current ||
            (await Dexie.waitFor(recordHash(current))) !==
              plan.expectedRecordHash ||
            plan.expectedRecordHash !== entry.after_record_sha256
          )
            fail('recovery_conflict')
          const drafts = this.drafts()
          if (!drafts.checked || drafts.ids.includes(plan.integrationId))
            fail('draft_state_unknown_or_exists')
          const restored = noteSchema.parse({
            ...entry.before,
            updatedAt: timestamp(current),
          })
          entry.restored_at = new Date().toISOString()
          entry.restored_record_sha256 = await Dexie.waitFor(
            recordHash(restored),
          )
          if (
            utf8(JSON.stringify(history)).length +
              history.operations.filter(
                (item) => item.kind === 'update' && !item.restored_at,
              ).length *
                100 >
            maxLumenHistoryBytes
          )
            fail('recovery_capacity')
          this.requireClearDraft(plan.integrationId)
          await this.database.table<Note, string>('notes').put(restored)
          await this.meta().put({
            key: lumenHistoryKey,
            value: historySchema.parse(history),
          })
          return restored
        },
      )
    } catch (error) {
      if (error instanceof LumenTransferError) throw error
      return fail('recovery_write_failed')
    }
  }
}
