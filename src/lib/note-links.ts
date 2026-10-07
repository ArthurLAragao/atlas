import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { Node, Parent } from 'unist'
import type { Note } from '../data/models'
import { noteKey, resolveNote } from './note-identity'

const parser = unified().use(remarkParse)
const excluded = new Set([
  'code',
  'inlineCode',
  'html',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'definition',
])
export interface WikiLink {
  title: string
  start: number
  end: number
}
/** Source ranges keep escaping and code intact when links are rendered or renamed. */
export function parseWikiLinks(content: string): WikiLink[] {
  const blocked: { start: number; end: number }[] = []
  function walk(node: Node) {
    if (excluded.has(node.type)) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start !== undefined && end !== undefined) blocked.push({ start, end })
    } else if ('children' in node) (node as Parent).children.forEach(walk)
  }
  walk(parser.parse(content))
  return [
    ...content.matchAll(/(?<!\[)\[\[([^[\]\r\n]{1,240})\]\](?!\])/gu),
  ].flatMap((match) => {
    const start = match.index
    const end = start + match[0].length
    let escapes = 0
    for (let i = start - 1; i >= 0 && content[i] === '\\'; i--) escapes++
    const title = match[1]!.trim()
    return !title ||
      escapes % 2 ||
      blocked.some((range) => start < range.end && end > range.start)
      ? []
      : [{ title, start, end }]
  })
}

export function noteEdges(
  notes: readonly Note[],
): { sourceId: string; targetId: string }[] {
  return notes.flatMap((note) =>
    [
      ...new Set(
        parseWikiLinks(note.content).flatMap((link) => {
          const target = resolveNote(link.title, notes)
          return target ? [target.id] : []
        }),
      ),
    ].map((targetId) => ({ sourceId: note.id, targetId })),
  )
}

export function backlinks(noteId: string, notes: readonly Note[]): Note[] {
  const incoming = new Set(
    noteEdges(notes)
      .filter((edge) => edge.targetId === noteId && edge.sourceId !== noteId)
      .map((edge) => edge.sourceId),
  )
  return notes
    .filter((note) => incoming.has(note.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}

export function renameWikiLinks(
  content: string,
  previous: string,
  next: string,
): string {
  let result = content
  for (const link of parseWikiLinks(content).reverse()) {
    if (noteKey(link.title) === noteKey(previous))
      result =
        result.slice(0, link.start) + `[[${next}]]` + result.slice(link.end)
  }
  return result
}

export function linkCompletion(
  content: string,
  caret: number,
): { start: number; end: number; query: string } | null {
  const before = content.slice(0, caret)
  const match = before.match(/(?<!\[)\[\[([^[\]\n\r]{0,240})$/u)
  if (!match) return null
  const start = caret - match[0].length
  const closing = content.slice(caret).match(/^[^[\]\r\n]*\]\]/u)
  const end = closing ? caret + closing[0].length : caret
  // Reuse the parser to avoid offering links in code or other Markdown links.
  const probe =
    content.slice(0, start) + '[[atlas-completion]]' + content.slice(end)
  if (!parseWikiLinks(probe).some((link) => link.start === start)) return null
  return {
    start,
    end,
    query: match[1]!,
  }
}

const escapeLabel = (value: string) =>
  value.replace(/[\\`*_{}[\]<>!|]/gu, '\\$&')
export function previewMarkdown(
  content: string,
  notes: readonly Note[],
): string {
  let output = content
  for (const link of parseWikiLinks(content).reverse()) {
    const target = resolveNote(link.title, notes)
    const href = target
      ? `/notas?note=${encodeURIComponent(target.id)}`
      : `/notas?search=${encodeURIComponent(link.title)}`
    output =
      output.slice(0, link.start) +
      `[${escapeLabel(link.title)}](${href})` +
      output.slice(link.end)
  }
  return output
}

export { noteKey, resolveNote } from './note-identity'
