import type { Note } from '../data/models'

/** JSON string scalars are also valid YAML; no custom executable metadata. */
export function exportNoteMarkdown(note: Note): string {
  return `---\ntitle: ${JSON.stringify(note.title)}\ntags: ${JSON.stringify(note.tags)}\narchivedAt: ${JSON.stringify(note.archivedAt ?? null)}\n---\n\n${note.content}\n`
}
export function readNoteMarkdown(source: string): {
  title: string
  tags: string[]
  archivedAt: string | null
  content: string
} | null {
  const match = source.match(
    /^---\r?\n(title: [^\n]+)\r?\n(tags: [^\n]+)\r?\n(archivedAt: [^\n]+)\r?\n---\r?\n\r?\n([\s\S]*)$/u,
  )
  if (!match) return null
  const parse = (line: string) =>
    JSON.parse(line.slice(line.indexOf(':') + 1).trim()) as unknown
  const title = parse(match[1]!)
  const tags = parse(match[2]!)
  const archivedAt = parse(match[3]!)
  if (
    typeof title !== 'string' ||
    !Array.isArray(tags) ||
    !tags.every((tag): tag is string => typeof tag === 'string') ||
    (archivedAt !== null && typeof archivedAt !== 'string')
  )
    throw new Error(
      'Metadados Markdown inválidos. Confira título, tags e arquivamento.',
    )
  const newline = source.startsWith('---\r\n') ? '\r\n' : '\n'
  const body = match[4]!
  return {
    title,
    tags,
    archivedAt,
    content: body.endsWith(newline) ? body.slice(0, -newline.length) : body,
  }
}
