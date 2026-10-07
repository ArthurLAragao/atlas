import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Note } from '../data/models'
import {
  backlinks,
  linkCompletion,
  noteEdges,
  noteKey,
  parseWikiLinks,
  previewMarkdown,
  renameWikiLinks,
  resolveNote,
} from './note-links'

const timestamp = '2026-10-02T12:00:00Z'
const note = (id: string, title: string, content = ''): Note => ({
  id,
  title,
  content,
  tags: [],
  links: [],
  isExample: false,
  createdAt: timestamp,
  updatedAt: timestamp,
})

describe('parser de links internos', () => {
  it('preserva Unicode, repetições, links adjacentes e posições no texto original', () => {
    const content = '🧭 [[  Ciência da Computação  ]][[Água]] e [[Água]].'
    const result = parseWikiLinks(content)
    expect(result.map((link) => link.title)).toEqual([
      'Ciência da Computação',
      'Água',
      'Água',
    ])
    expect(result[0]).toMatchObject({ start: 3, end: 32 })
    expect(result.map((link) => content.slice(link.start, link.end))).toEqual([
      '[[  Ciência da Computação  ]]',
      '[[Água]]',
      '[[Água]]',
    ])
  })

  it('ignora código inline, cercas, código indentado, HTML e links Markdown', () => {
    const content = [
      '`[[Inline]]`',
      '```md',
      '[[Cerca]]',
      '```',
      '    [[Indentado]]',
      '',
      '<div>',
      '[[Bloco HTML]]',
      '</div>',
      '',
      '<img alt="[[Atributo HTML]]">',
      '',
      '[Veja [[Link Markdown]]](https://example.com)',
      '![Imagem [[Legenda]]](https://example.com/image.png)',
      '[[Visível]]',
    ].join('\n')
    expect(parseWikiLinks(content).map((link) => link.title)).toEqual([
      'Visível',
    ])
  })

  it('ignora referências Markdown e suas definições', () => {
    const content = [
      '[Veja [[Referência]]][alvo]',
      '',
      '[alvo]: https://example.com "[[Definição]]"',
      '',
      '[[Outra nota]]',
    ].join('\n')
    expect(parseWikiLinks(content).map((link) => link.title)).toEqual([
      'Outra nota',
    ])
  })

  it('trata um número ímpar de barras como escape e pares como barras literais', () => {
    const content = String.raw`\[[Escapado]] \\[[Ativo]] \\\[[Escapado também]]`
    expect(parseWikiLinks(content).map((link) => link.title)).toEqual(['Ativo'])
  })

  it.each([
    '[[]]',
    '[[   ]]',
    '[[uma\nnota]]',
    '[[uma\rnota]]',
    '[[[Nota]]]',
    '[[Nota]',
    `[[${'a'.repeat(241)}]]`,
  ])('não aceita sintaxe incompleta ou inválida: %s', (content) => {
    expect(parseWikiLinks(content)).toEqual([])
  })

  it('aceita o limite do título e links em títulos, listas e ênfase', () => {
    const title = 'a'.repeat(240)
    const content = `# [[${title}]]\n- **[[Lista]]**\n> [[Citação]]`
    expect(parseWikiLinks(content).map((link) => link.title)).toEqual([
      title,
      'Lista',
      'Citação',
    ])
  })
})

describe('resolução, vínculos e backlinks', () => {
  it('normaliza composição Unicode, caixa e espaços sem confundir acentos', () => {
    expect(noteKey('  CIE\u0302NCIA   de Dados ')).toBe('ciência de dados')
    const target = note('target', 'Ciência de Dados')
    expect(resolveNote(' cie\u0302ncia  DE dados ', [target])).toBe(target)
    expect(resolveNote('Ciencia de Dados', [target])).toBeUndefined()
  })

  it('não escolhe arbitrariamente entre nomes ambíguos nem entre ausentes', () => {
    const first = note('first', 'Redes')
    const second = note('second', ' redes ')
    expect(resolveNote('REDES', [first, second])).toBeUndefined()
    expect(resolveNote('AWS', [first, second])).toBeUndefined()
  })

  it('deduplica vínculos, mantém a base do futuro grafo e exclui autorreferência dos backlinks', () => {
    const notes = [
      note('target', 'Redes', '[[Redes]]'),
      note('z', 'Zoologia', '[[Redes]] e [[REDES]]'),
      note('a', 'Algoritmos', '[[Redes]] [[Ausente]]'),
      note('code', 'Código', '`[[Redes]]`'),
      { ...note('archived', 'Arquivada', '[[Redes]]'), archivedAt: timestamp },
    ]
    const before = structuredClone(notes)
    expect(noteEdges(notes)).toEqual([
      { sourceId: 'target', targetId: 'target' },
      { sourceId: 'z', targetId: 'target' },
      { sourceId: 'a', targetId: 'target' },
      { sourceId: 'archived', targetId: 'target' },
    ])
    expect(backlinks('target', notes).map((item) => item.id)).toEqual([
      'a',
      'archived',
      'z',
    ])
    expect(notes).toEqual(before)
  })

  it('não cria vínculos nem backlinks para um nome ambíguo', () => {
    const notes = [
      note('a', 'Redes'),
      note('b', 'REDES'),
      note('source', 'Aula', '[[Redes]]'),
    ]
    expect(noteEdges(notes)).toEqual([])
    expect(backlinks('a', notes)).toEqual([])
  })

  it('renomeia ocorrências reais de trás para frente e preserva outros trechos', () => {
    const content =
      String.raw`[[Rede]][[ REDE ]] e [[Redes]]. \[[Rede]] e ` + '`[[Rede]]`'
    expect(renameWikiLinks(content, 'rede', 'Redes e sistemas')).toBe(
      String.raw`[[Redes e sistemas]][[Redes e sistemas]] e [[Redes]]. \[[Rede]] e ` +
        '`[[Rede]]`',
    )
    expect(renameWikiLinks(content, 'Ausente', 'Outro')).toBe(content)
  })
})

describe('autocomplete de links', () => {
  it('identifica consulta e intervalo de substituição, incluindo fechamento existente', () => {
    expect(linkCompletion('Aula [[', 7)).toEqual({
      start: 5,
      end: 7,
      query: '',
    })
    const content = 'Aula [[Água]] depois'
    const caret = content.indexOf(']]')
    expect(linkCompletion(content, caret)).toEqual({
      start: 5,
      end: caret + 2,
      query: 'Água',
    })
    const unfinished = '[[Ciência da Com'
    expect(linkCompletion(unfinished, unfinished.length)).toEqual({
      start: 0,
      end: unfinished.length,
      query: 'Ciência da Com',
    })
  })

  it.each([
    '`[[Red`',
    '```md\n[[Red\n```',
    '<div>\n[[Red\n</div>',
    '[Veja [[Red]]](https://example.com)',
    String.raw`\[[Red`,
    '[[[Red',
    'texto sem link',
  ])('não sugere em sintaxe excluída: %s', (content) => {
    const target = content.indexOf('Red')
    const caret = target >= 0 ? target + 3 : content.length
    expect(linkCompletion(content, caret)).toBeNull()
  })

  it('encerra a consulta quando o caret passa para uma nova linha', () => {
    const content = '[[Red\n'
    expect(linkCompletion(content, content.length)).toBeNull()
  })

  it('oferece autocomplete depois de barras literais escapadas em pares', () => {
    const content = String.raw`\\[[Red`
    expect(linkCompletion(content, content.length)).toEqual({
      start: 2,
      end: content.length,
      query: 'Red',
    })
  })

  it('aceita consultas Unicode e não altera o conteúdo fornecido', () => {
    const content = '🧭 [[Água e código'
    const before = content
    expect(linkCompletion(content, content.length)).toEqual({
      start: 3,
      end: content.length,
      query: 'Água e código',
    })
    expect(content).toBe(before)
  })

  it('substitui o link fechado inteiro quando o caret está no meio do título', () => {
    const content = 'Texto [[Água]] fim'
    const caret = content.indexOf('Água') + 2
    const completion = linkCompletion(content, caret)
    expect(completion).toEqual({
      start: 6,
      end: content.indexOf(']]') + 2,
      query: 'Ág',
    })
    if (!completion) throw new Error('Esperava uma consulta de link')
    expect(
      content.slice(0, completion.start) +
        '[[Nova nota]]' +
        content.slice(completion.end),
    ).toBe('Texto [[Nova nota]] fim')
  })
})

describe('Markdown da pré-visualização', () => {
  it('usa IDs estáveis para alvos resolvidos e busca para ausentes ou ambíguos', () => {
    const notes = [
      note('note-target', 'Água'),
      note('one', 'Redes'),
      note('two', 'REDES'),
    ]
    expect(previewMarkdown('[[Água]] [[Não existe]] [[Redes]]', notes)).toBe(
      '[Água](/notas?note=note-target) [Não existe](/notas?search=N%C3%A3o%20existe) [Redes](/notas?search=Redes)',
    )
  })

  it('escapa o rótulo para não injetar formatação e mantém código intacto', () => {
    const title = '*nome*! _teste_ \\ fim'
    const target = note('safe', title)
    const content = `[[${title}]] e \`[[${title}]]\``
    expect(previewMarkdown(content, [target])).toBe(
      '[\\*nome\\*\\! \\_teste\\_ \\\\ fim](/notas?note=safe) e ' +
        `\`[[${title}]]\``,
    )
  })

  it('escapa sinais de comparação que são texto, sem produzir HTML no rótulo', () => {
    const target = note('comparison', '1 < 2 > 0 {exemplo}')
    expect(previewMarkdown('[[1 < 2 > 0 {exemplo}]]', [target])).toBe(
      '[1 \\< 2 \\> 0 \\{exemplo\\}](/notas?note=comparison)',
    )
  })

  it('não converte pseudolinks que atravessam HTML ou código inline', () => {
    const content = '[[<script>inseguro</script>]] e [[Nome `literal`]]'
    const targets = [
      note('html', '<script>inseguro</script>'),
      note('code', 'Nome `literal`'),
    ]
    expect(previewMarkdown(content, targets)).toBe(content)
  })

  it('mantém títulos com pipe como um link único dentro de uma célula GFM', () => {
    const target = note('pipe', 'AWS | DevOps')
    const content = '| Referência |\n| --- |\n| [[AWS | DevOps]] |'
    const source = previewMarkdown(content, [target])
    expect(source).toContain('[AWS \\| DevOps](/notas?note=pipe)')
    const tree = unified().use(remarkParse).use(remarkGfm).parse(source)
    const table = tree.children[0]
    expect(table?.type).toBe('table')
    if (table?.type !== 'table') throw new Error('Esperava uma tabela GFM')
    const cells = table.children[1]!.children
    expect(cells).toHaveLength(1)
    expect(cells[0]!.children).toMatchObject([
      {
        type: 'link',
        url: '/notas?note=pipe',
        children: [{ type: 'text', value: 'AWS | DevOps' }],
      },
    ])
  })
})
