import { describe, expect, it } from 'vitest'
import { emptySnapshot, type Note } from '../data/models'
import { exportNoteMarkdown, readNoteMarkdown } from './note-markdown'
import { encodeMarkdown, markdownMarker, parseImport } from './transfer'

const now = new Date('2026-10-02T12:00:00Z')
const source: Note = {
  id: 'note-export',
  title: 'Aula: "Redes" e Ciência',
  tags: ['faculdade', 'com "aspas"', 'caminho\\local', 'ação'],
  content:
    '# Conhecimento\n\nVeja [[Outra nota]] e `[[Literal]]`.\n\n```ts\nconst valor = "ação"\n```',
  archivedAt: '2026-10-01T10:00:00Z',
  links: [],
  isExample: false,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

describe('exportação Markdown de uma nota', () => {
  it('preserva título, tags com aspas/barras, arquivamento e links internos literalmente', () => {
    const before = structuredClone(source)
    const text = exportNoteMarkdown(source)
    expect(text).toContain('[[Outra nota]]')
    expect(text).toContain('title: "Aula: \\"Redes\\" e Ciência"')
    expect(readNoteMarkdown(text)).toEqual({
      title: source.title,
      tags: source.tags,
      archivedAt: source.archivedAt,
      content: source.content,
    })
    expect(source).toEqual(before)
  })

  it.each([
    '',
    'sem quebra final',
    'com quebra\n',
    'duas quebras\n\n',
    'CRLF\r\ntexto\r\n',
    'retorno isolado\r',
  ])('faz ida e volta sem acrescentar nem remover texto: %j', (content) => {
    const item = { ...source, content, archivedAt: null }
    expect(readNoteMarkdown(exportNoteMarkdown(item))).toEqual({
      title: item.title,
      tags: item.tags,
      archivedAt: null,
      content,
    })
  })

  it('exporta notas antigas sem archivedAt como notas ativas', () => {
    const legacy = { ...source }
    delete legacy.archivedAt
    expect(readNoteMarkdown(exportNoteMarkdown(legacy))?.archivedAt).toBeNull()
  })

  it('aceita metadados e separadores CRLF', () => {
    const markdown = exportNoteMarkdown({
      ...source,
      content: 'Texto simples',
    }).replace(/\n/gu, '\r\n')
    expect(readNoteMarkdown(markdown)).toEqual({
      title: source.title,
      tags: source.tags,
      archivedAt: source.archivedAt,
      content: 'Texto simples',
    })
  })

  it.each([
    '# Markdown comum\n\nTexto',
    '---\ntitle: "Aula"\n---\n\nTexto',
    '---\ntags: []\ntitle: "Aula"\narchivedAt: null\n---\n\nTexto',
  ])(
    'não interpreta prosa ou frontmatter não Atlas como metadados Atlas: %j',
    (text) => {
      expect(readNoteMarkdown(text)).toBeNull()
    },
  )

  it.each([
    ['title', '42'],
    ['tags', '["válida", 42]'],
    ['tags', '"tag"'],
    ['archivedAt', 'true'],
  ])('rejeita tipo inválido em %s', (field, value) => {
    const text = exportNoteMarkdown(source).replace(
      new RegExp(`^${field}: .+$`, 'mu'),
      `${field}: ${value}`,
    )
    expect(() => readNoteMarkdown(text)).toThrow(/Metadados Markdown inválidos/)
  })
})

describe('importação de Markdown com links internos', () => {
  it('restaura nota independente preservando metadados e texto e atribui identidade local nova', () => {
    const data = parseImport(
      exportNoteMarkdown(source),
      'aula.md',
      now,
      'note-imported',
    )
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0]).toEqual({
      id: 'note-imported',
      title: source.title,
      content: source.content,
      tags: source.tags,
      archivedAt: source.archivedAt,
      links: [],
      isExample: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    expect(data.tasks).toEqual([])
  })

  it('não confunde o marcador de backup no corpo de uma nota com um backup completo', () => {
    const item = {
      ...source,
      content: `[[Outra nota]]\n\n${markdownMarker}\n\n\`\`\`json\n{"estudo": true}\n\`\`\``,
    }
    const data = parseImport(
      exportNoteMarkdown(item),
      'marker.md',
      now,
      'marker-import',
    )
    expect(data.notes[0]?.content).toBe(item.content)
    expect(data.notes[0]?.title).toBe(item.title)
  })

  it('restaura backup completo com nota arquivada, wiki links e marcador no texto', () => {
    const data = emptySnapshot()
    data.notes = [
      { ...source, content: `${source.content}\n\n${markdownMarker}` },
    ]
    expect(
      parseImport(encodeMarkdown(data, now), 'atlas.markdown', now),
    ).toEqual(data)
  })

  it('aceita BOM na nota exportada e rejeita dados inválidos antes da persistência', () => {
    expect(
      parseImport(`\uFEFF${exportNoteMarkdown(source)}`, 'AULA.MD', now, 'bom')
        .notes[0]?.content,
    ).toBe(source.content)
    const invalidDate = exportNoteMarkdown(source).replace(
      '2026-10-01T10:00:00Z',
      'ontem',
    )
    expect(() => parseImport(invalidDate, 'aula.md', now, 'bad')).toThrow()
    const invalidTitle = exportNoteMarkdown(source).replace(
      /^title: .+$/mu,
      'title: ""',
    )
    expect(() => parseImport(invalidTitle, 'aula.md', now, 'bad')).toThrow()
  })
})
