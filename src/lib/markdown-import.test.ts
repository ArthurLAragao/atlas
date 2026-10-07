import { describe, expect, it } from 'vitest'
import { emptySnapshot } from '../data/models'
import {
  parseMarkdownNote,
  planMarkdownImport,
  validateMarkdownFile,
  validateMarkdownFiles,
  markdownLimits,
} from './markdown-import'
const now = '2026-10-03T12:00:00.000Z'
const parse = (text: string, id = 'note') =>
  parseMarkdownNote(text, 'meu-resumo.md', now, id)
describe('importação local de Markdown', () => {
  it('preserva conteúdo, links internos e metadados simples', () => {
    const { note } = parse(
      '---\nid: aula\ntitle: "Estruturas"\ntags: ["faculdade", "algoritmos"]\n---\n\n# Aula\nVeja [[Árvores]].',
    )
    expect(note).toMatchObject({
      id: 'aula',
      title: 'Estruturas',
      tags: ['faculdade', 'algoritmos'],
      content: '# Aula\nVeja [[Árvores]].',
      isExample: false,
    })
  })
  it('usa título fora de blocos de código e nome do arquivo como fallback', () => {
    expect(parse('```md\n# Exemplo\n```\n# Aula real').note.title).toBe(
      'Aula real',
    )
    const result = parse('Anotação sem cabeçalho.')
    expect(result.note.title).toBe('meu-resumo')
    expect(result.warnings).toContain('Sem título: usamos o nome do arquivo.')
  })
  it('preserva metadados desconhecidos e reconhece lista de tags', () => {
    const result = parse(
      '---\ntags:\n - cloud\n - #cloud\n - estudo\ncourse: UNIVERSIDADE EXEMPLO\n---\n# Redes',
    )
    expect(result.note.tags).toEqual(['cloud', 'estudo'])
    expect(result.note.content).toContain('course: UNIVERSIDADE EXEMPLO')
  })
  it.each([
    '<script>alert(1)</script>',
    '<iframe src="/">',
    '<div onclick="x()">',
    '\0texto',
    '---\ntitle: incompleto',
    '---\ntags: ["ok", 1]\n---\n# Nota',
    '---\ncustom: <script>alert(1)</script>\n---\n# Nota',
  ])('rejeita entrada insegura ou inválida: %s', (text) => {
    expect(() => parse(text)).toThrow()
  })
  it('permite ensinar scripts em blocos de código, sem executá-los', () => {
    expect(
      parse('# Segurança\n```html\n<script>alert(1)</script>\n```').note
        .content,
    ).toContain('<script>')
  })
  it('não trunca notas além do limite do modelo', () => {
    expect(() => parse('x'.repeat(500_001))).toThrow('500.000')
  })
  it('valida formato, MIME, quantidade e tamanhos sem ler arquivos', () => {
    const file = { name: 'a.md', size: 1, type: 'text/markdown' }
    expect(() => validateMarkdownFile(file)).not.toThrow()
    expect(() => validateMarkdownFile({ ...file, name: 'a.html' })).toThrow(
      '.md',
    )
    expect(() => validateMarkdownFile({ ...file, type: 'image/png' })).toThrow(
      '.md',
    )
    expect(() =>
      validateMarkdownFile({ ...file, size: markdownLimits.file + 1 }),
    ).toThrow('1 MB')
    expect(() =>
      validateMarkdownFiles(Array.from({ length: 21 }, () => file)),
    ).toThrow('20')
    expect(() =>
      validateMarkdownFiles([{ ...file, size: markdownLimits.total + 1 }]),
    ).toThrow('10 MB')
  })
  it('detecta duplicatas por ID ou título/conteúdo e também dentro do lote', () => {
    const data = emptySnapshot(),
      note = parse('# Redes', 'a').note
    data.notes = [note]
    const same = { ...note, id: 'b' }
    expect(
      planMarkdownImport(
        [same, { ...note, content: 'novo' }],
        data,
        'ignore',
        [],
      ).skipped,
    ).toBe(2)
    const copy = planMarkdownImport([same], data, 'copy', ['copy'])
    expect(copy.imported[0]?.id).toBe('copy')
    expect(data.notes).toEqual([note])
    expect(
      planMarkdownImport([note, same], emptySnapshot(), 'ignore', []).imported,
    ).toHaveLength(1)
  })
})
