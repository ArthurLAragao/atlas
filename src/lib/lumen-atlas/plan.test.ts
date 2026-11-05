import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { emptySnapshot, type Note } from '../../data/models'
import { decodeLumenPackage } from './package'
import { planLumenImport } from './plan'
import { changedPackage, decodeSample, id, setupCrypto } from './test-fixtures'

beforeEach(setupCrypto)
afterEach(() => vi.unstubAllGlobals())
const drafts = { checked: true, ids: [] }
const known = { ready: true, knownIds: [id], atCapacity: false }
const unknown = { ...known, knownIds: [] }
async function local(): Promise<Note> {
  const pkg = await decodeSample()
  return {
    id,
    title: pkg.title,
    tags: [...pkg.tags],
    content: pkg.markdown,
    links: [],
    isExample: false,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T11:00:00Z',
    archivedAt: null,
  }
}
it('plans creation without mutating a snapshot', async () => {
  const data = emptySnapshot()
  const before = structuredClone(data)
  const plan = await planLumenImport(
    await decodeSample(),
    data,
    drafts,
    unknown,
  )
  expect(plan.operation).toBe('create')
  expect(plan.expectedUpdatedAt).toBeNull()
  expect(data).toEqual(before)
})
it('plans identical reimport and a valid baseline update with exact differences', async () => {
  const current = await local()
  const data = { ...emptySnapshot(), notes: [current] }
  expect(
    (await planLumenImport(await decodeSample(), data, drafts, known))
      .operation,
  ).toBe('identical')
  const baseline = (await decodeSample()).comparison_sha256
  const pkg = await decodeLumenPackage(
    await changedPackage({
      text: 'New fictional text',
      tags: ['new'],
      baseline,
    }),
  )
  const plan = await planLumenImport(pkg, data, drafts, known)
  expect(plan.operation).toBe('update')
  expect(plan.changedFields).toEqual(['tags', 'content'])
  expect(plan.expectedUpdatedAt).toBe(current.updatedAt)
})
it.each(['missing', 'undelivered', 'local', 'title', 'no-baseline'] as const)(
  'blocks %s conflicts',
  async (scenario) => {
    const current = await local()
    const baseline = (await decodeSample()).comparison_sha256
    let pkg = await decodeLumenPackage(
      await changedPackage({ text: 'New text', baseline }),
    )
    let notes = [current]
    if (scenario === 'missing') notes = []
    if (scenario === 'undelivered')
      pkg = await decodeLumenPackage(
        await changedPackage({
          text: 'Next version',
          baseline: '1'.repeat(64),
        }),
      )
    if (scenario === 'local') notes = [{ ...current, content: 'Local edit' }]
    if (scenario === 'title')
      pkg = await decodeLumenPackage(
        await changedPackage({ title: 'Renamed', baseline }),
      )
    if (scenario === 'no-baseline')
      pkg = await decodeLumenPackage(
        await changedPackage({ text: 'New version' }),
      )
    const plan = await planLumenImport(
      pkg,
      { ...emptySnapshot(), notes },
      drafts,
      known,
    )
    expect(plan.operation).toBe('conflict')
    expect(plan.conflicts.length).toBeGreaterThan(0)
  },
)
it('does not adopt another ID with the same title or content, including ambiguous candidates', async () => {
  const current = await local()
  for (const notes of [
    [{ ...current, id: 'other' }],
    [{ ...current, id: 'other', title: 'Other' }],
    [
      { ...current, id: 'other' },
      { ...current, id: 'second' },
    ],
  ]) {
    const plan = await planLumenImport(
      await decodeSample(),
      { ...emptySnapshot(), notes },
      drafts,
      unknown,
    )
    expect(plan.conflicts).toContain('candidate_under_other_id')
  }
})
it('blocks uncertain identity, unknown drafts, existing drafts, unavailable recovery and capacity', async () => {
  const data = { ...emptySnapshot(), notes: [await local()] }
  expect(
    (await planLumenImport(await decodeSample(), data, drafts, unknown))
      .conflicts,
  ).toContain('identity_uncertain')
  for (const status of [
    { checked: false, ids: [] },
    { checked: true, ids: [id] },
  ])
    expect(
      (await planLumenImport(await decodeSample(), data, status, known))
        .operation,
    ).toBe('conflict')
  expect(
    (
      await planLumenImport(await decodeSample(), data, drafts, {
        ...known,
        ready: false,
      })
    ).conflicts,
  ).toContain('recovery_unavailable')
  const pkg = await decodeLumenPackage(
    await changedPackage({
      text: 'New text',
      baseline: (await decodeSample()).comparison_sha256,
    }),
  )
  expect(
    (await planLumenImport(pkg, data, drafts, { ...known, atCapacity: true }))
      .conflicts,
  ).toContain('recovery_capacity')
})
it('never recreates a known identity with its target absent, even without a baseline', async () => {
  expect(
    (
      await planLumenImport(
        await decodeSample(),
        emptySnapshot(),
        drafts,
        known,
      )
    ).conflicts,
  ).toContain('update_target_missing')
})
