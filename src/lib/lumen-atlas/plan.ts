import { collections, type Note, type Snapshot } from '../../data/models'
import { noteKey } from '../note-identity'
import { assertPackage, type LumenPackage } from './package'
import { comparisonHash, recordHash } from './hashes'
import { fail } from './errors'

export type DraftStatus = Readonly<{ checked: boolean; ids: readonly string[] }>
export type RecoveryStatus = Readonly<{
  ready: boolean
  knownIds: readonly string[]
  atCapacity: boolean
}>
export interface LumenImportPlan {
  readonly operation: 'create' | 'identical' | 'update' | 'conflict'
  readonly integrationId: string
  readonly expectedUpdatedAt: string | null
  readonly expectedRecordHash: string
  readonly proposed: LumenPackage
  readonly changedFields: readonly ('tags' | 'content')[]
  readonly warnings: readonly string[]
  readonly conflicts: readonly string[]
}
const plans = new WeakSet<object>()
export function assertPlan(plan: LumenImportPlan): void {
  if (!plans.has(plan)) fail('unvalidated_plan')
  assertPackage(plan.proposed)
}
/** Read-only planning. A matching baseline never proves that a package was delivered. */
export async function planLumenImport(
  pkg: LumenPackage,
  data: Snapshot,
  drafts: DraftStatus,
  recovery: RecoveryStatus,
): Promise<LumenImportPlan> {
  assertPackage(pkg)
  const current = data.notes.find((note) => note.id === pkg.integration_id)
  const conflicts: string[] = []
  const changedFields: ('tags' | 'content')[] = []
  let operation: LumenImportPlan['operation'] = 'create'
  const known = recovery.knownIds.includes(pkg.integration_id)
  if (!drafts.checked) conflicts.push('draft_state_unknown')
  else if (drafts.ids.includes(pkg.integration_id))
    conflicts.push('draft_exists')
  if (!recovery.ready) conflicts.push('recovery_unavailable')
  if (
    collections.some(
      (name) =>
        name !== 'notes' &&
        data[name].some((item) => item.id === pkg.integration_id),
    )
  )
    conflicts.push('identity_in_other_collection')
  const candidates = data.notes.filter(
    (note) =>
      note.id !== pkg.integration_id &&
      (noteKey(note.title) === noteKey(pkg.title) ||
        note.content === pkg.markdown),
  )
  if (candidates.length) conflicts.push('candidate_under_other_id')
  if (!current) {
    if (pkg.baseline_sha256 !== null || known)
      conflicts.push('update_target_missing')
    if (data.notes.length >= 10_000) conflicts.push('note_limit')
  } else {
    if (!known) conflicts.push('identity_uncertain')
    const hash = await comparisonHash(
      current.title,
      current.tags,
      current.content,
    )
    if (hash === pkg.comparison_sha256) operation = 'identical'
    else {
      operation = 'update'
      if (current.title !== pkg.title) conflicts.push('title_changed')
      if (pkg.baseline_sha256 === null) conflicts.push('baseline_required')
      else if (hash !== pkg.baseline_sha256) conflicts.push('baseline_mismatch')
      if (JSON.stringify(current.tags) !== JSON.stringify(pkg.tags))
        changedFields.push('tags')
      if (current.content !== pkg.markdown) changedFields.push('content')
    }
  }
  if (operation !== 'identical' && recovery.atCapacity)
    conflicts.push('recovery_capacity')
  const result: LumenImportPlan = Object.freeze({
    operation: conflicts.length ? 'conflict' : operation,
    integrationId: pkg.integration_id,
    expectedUpdatedAt: current?.updatedAt ?? null,
    expectedRecordHash: await recordHash(current ?? null),
    proposed: pkg,
    changedFields: Object.freeze(changedFields),
    warnings: Object.freeze([
      ...pkg.warnings,
      'wikilinks_preserved_without_resolution',
      'local_recovery_not_in_backups',
    ]),
    conflicts: Object.freeze(conflicts),
  })
  plans.add(result)
  return result
}
export function transferableFields(note: Note) {
  return { title: note.title, tags: note.tags, markdown: note.content }
}
