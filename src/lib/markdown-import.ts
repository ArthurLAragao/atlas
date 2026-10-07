import {
  noteSchema,
  collections,
  type Note,
  type Snapshot,
} from '../data/models'
export const markdownLimits = {
  count: 20,
  file: 1024 * 1024,
  total: 10 * 1024 * 1024,
}
export type DuplicatePolicy = 'ask' | 'ignore' | 'copy'
export interface MarkdownFile {
  name: string
  size: number
  type: string
}
export function validateMarkdownFiles(files: MarkdownFile[]) {
  if (files.length > markdownLimits.count)
    throw new Error('Selecione até 20 arquivos por operação.')
  if (files.reduce((sum, file) => sum + file.size, 0) > markdownLimits.total)
    throw new Error('O total supera 10 MB. Importe em grupos menores.')
}
export function validateMarkdownFile(file: MarkdownFile) {
  if (
    !/\.md$/iu.test(file.name) ||
    (file.type && !['text/markdown', 'text/plain'].includes(file.type))
  )
    throw new Error(
      'Use somente arquivos .md de texto Markdown. Outros formatos não são aceitos.',
    )
  if (file.size > markdownLimits.file)
    throw new Error(
      'Este arquivo supera 1 MB. Divida a nota e tente novamente.',
    )
}
function scalar(value: string): string {
  const text = value.trim()
  if (text.startsWith('"')) {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'string')
      throw new Error('Use texto simples nos metadados.')
    return parsed
  }
  return text.replace(/^'(.*)'$/u, '$1')
}
export function parseMarkdownNote(
  source: string,
  filename: string,
  now: string,
  id: string,
): { note: Note; warnings: string[] } {
  if (source.includes('\0'))
    throw new Error('O arquivo não parece ser texto Markdown legível.')
  let body = source.replace(/^\uFEFF/u, ''),
    title = '',
    tags: string[] = [],
    sourceId = id,
    archivedAt: string | null = null
  const warnings: string[] = [],
    unknown: string[] = []
  if (body.startsWith('---\n') || body.startsWith('---\r\n')) {
    const match = body.match(
      /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/u,
    )
    if (!match)
      throw new Error(
        'Metadados incompletos. Feche o frontmatter com --- e tente novamente.',
      )
    body = match[2]!.replace(/^\r?\n/u, '')
    let readingTags = false
    for (const line of match[1]!.split(/\r?\n/u)) {
      if (readingTags && /^\s*-\s+/u.test(line)) {
        tags.push(scalar(line.replace(/^\s*-\s+/u, '')))
        continue
      }
      readingTags = false
      const entry = line.match(/^([a-zA-Z]+):\s*(.*)$/u)
      if (!entry) {
        if (line.trim()) unknown.push(line)
        continue
      }
      const [, key, raw] = entry
      if (key === 'title') title = scalar(raw!)
      else if (key === 'id') sourceId = scalar(raw!)
      else if (key === 'tags') {
        if (!raw!.trim()) {
          readingTags = true
          continue
        }
        if (raw!.trim().startsWith('[')) {
          try {
            const parsed: unknown = JSON.parse(raw!)
            if (
              !Array.isArray(parsed) ||
              !parsed.every((t): t is string => typeof t === 'string')
            )
              throw new TypeError('Tags devem ser textos.')
            tags = parsed
          } catch (error) {
            if (error instanceof TypeError) throw error
            tags = raw!
              .trim()
              .replace(/^\[|\]$/gu, '')
              .split(',')
              .map(scalar)
          }
        } else
          tags = scalar(raw!)
            .split(',')
            .map((t) => t.trim())
      } else if (key === 'archivedAt')
        archivedAt = raw === 'null' ? null : scalar(raw!)
      else unknown.push(line)
    }
  }
  if (unknown.length) {
    body = `---\n${unknown.join('\n')}\n---\n\n${body}`
    warnings.push('Metadados desconhecidos foram preservados no texto.')
  }
  const active = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/gu, '')
  if (
    /<(?:script|iframe|object|embed|svg|math|form|style|link|meta)\b|<[^>]+\bon\w+\s*=/iu.test(
      active,
    )
  )
    throw new Error(
      'HTML ativo não é aceito. Remova scripts, iframes e atributos executáveis; código em blocos Markdown pode ficar como texto.',
    )
  if (!title) title = active.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? ''
  if (!title) {
    title = filename.replace(/\.md$/iu, '').trim() || 'Nota importada'
    warnings.push('Sem título: usamos o nome do arquivo.')
  }
  const parsed = noteSchema.safeParse({
    id: sourceId,
    title,
    content: body,
    tags: [
      ...new Set(tags.map((t) => t.replace(/^#/u, '').trim()).filter(Boolean)),
    ],
    links: [],
    createdAt: now,
    updatedAt: now,
    isExample: false,
    archivedAt,
  })
  if (!parsed.success)
    throw new Error(
      'Revise título (até 240 caracteres), tags, ID e datas. Cada nota aceita até 500.000 caracteres; divida textos maiores.',
    )
  return { note: parsed.data, warnings }
}
function fingerprint(note: Note) {
  return `${note.title.trim().normalize('NFC').toLocaleLowerCase('pt-BR')}\0${note.content.replace(/\r\n/gu, '\n').trim()}`
}
export function planMarkdownImport(
  notes: Note[],
  data: Snapshot,
  policy: DuplicatePolicy,
  copyIds: string[],
) {
  const ids = new Set(
      collections.flatMap((name) => data[name].map((item) => item.id)),
    ),
    fingerprints = new Set(data.notes.map(fingerprint))
  const imported: Note[] = [],
    duplicates: Note[] = []
  notes.forEach((note, index) => {
    const duplicate = ids.has(note.id) || fingerprints.has(fingerprint(note))
    if (duplicate) {
      duplicates.push(note)
      if (policy !== 'copy') return
    }
    const next = duplicate ? { ...note, id: copyIds[index]! } : note
    if (!next.id || ids.has(next.id))
      throw new Error(
        'Conflito de identificador. Escolha importar como cópia e tente novamente.',
      )
    imported.push(next)
    ids.add(next.id)
    fingerprints.add(fingerprint(next))
  })
  return {
    imported,
    duplicates,
    skipped: policy === 'copy' ? 0 : duplicates.length,
  }
}
