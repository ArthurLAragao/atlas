// Preserve synchronous public exports; only example removal needs Markdown parsing.
export * from './data-records'
import { collections, type Entity, type Snapshot } from '../data/models'
import { references, replaceCollection } from './data-records'
import { noteEdges } from './note-links'

export function removableExamples(data: Snapshot): Snapshot {
  const records = collections.flatMap((name) => data[name] as Entity[])
  const byId = new Map(records.map((item) => [item.id, item]))
  const keep = new Set<string>()
  const wikiTargets = new Map<string, string[]>()
  for (const edge of noteEdges(data.notes)) {
    const targets = wikiTargets.get(edge.sourceId) ?? []
    targets.push(edge.targetId)
    wikiTargets.set(edge.sourceId, targets)
  }
  const queue = records.filter((item) => !item.isExample).map((item) => item.id)
  while (queue.length) {
    const id = queue.pop()
    if (!id || keep.has(id)) continue
    keep.add(id)
    const item = byId.get(id)
    if (item) queue.push(...references(item), ...(wikiTargets.get(id) ?? []))
  }
  let result = { ...data }
  for (const name of collections) {
    result = replaceCollection(
      result,
      name,
      data[name].filter((item) => item.isExample && !keep.has(item.id)),
    )
  }
  return result
}
