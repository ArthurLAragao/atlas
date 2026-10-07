import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import {
  createSearchIndex,
  searchEntries,
  searchHref,
  searchKey,
} from './search'

const now = new Date('2026-10-02T12:00:00Z')

describe('índice de busca global', () => {
  it('indexa os cinco tipos incluindo conteúdo, subtarefas, resultados-chave e links do projeto', () => {
    const data = buildSeed(now)
    data.tasks[0]!.subtasks = [
      { id: 'sub', title: 'Revisar TCP/IP', done: false },
    ]
    data.habits[0]!.unit = 'sessão'
    data.goals[0]!.keyResults[0]!.title = 'Praticar Kotlin'
    data.projects[0]!.urls = [
      { title: 'Manual Docker', url: 'https://example.com' },
    ]
    const before = structuredClone(data)
    const index = createSearchIndex(data)
    expect(new Set(index.map((item) => item.type))).toEqual(
      new Set(['tasks', 'habits', 'notes', 'goals', 'projects']),
    )
    expect(index).toHaveLength(14)
    expect(searchEntries(index, 'TCP/IP').map((item) => item.type)).toEqual([
      'tasks',
    ])
    expect(searchEntries(index, 'sessao').map((item) => item.type)).toEqual([
      'habits',
    ])
    expect(searchEntries(index, 'Kotlin').map((item) => item.type)).toEqual([
      'goals',
    ])
    expect(searchEntries(index, 'Docker').map((item) => item.type)).toEqual([
      'projects',
    ])
    expect(searchEntries(index, 'árvores').map((item) => item.id)).toEqual([
      'example-note-0',
    ])
    expect(data).toEqual(before)
  })

  it('normaliza caixa, diacríticos, composição Unicode e espaços', () => {
    expect(searchKey('  AÇÃO\t e\n CIE\u0302NCIA  ')).toBe('acao e ciencia')
    const data = buildSeed(now)
    data.notes[0]!.content = 'Uma ação em Ciência da Computação'
    expect(searchEntries(createSearchIndex(data), 'ACAO ciencia')).toHaveLength(
      1,
    )
  })

  it('combina todos os termos e tags exatas, sem retornar coincidências parciais de tag', () => {
    const data = buildSeed(now)
    data.notes[0]!.tags = ['Ciência', 'redes-seguras']
    data.notes[0]!.content = 'Revisar protocolo TLS'
    data.notes[1]!.tags = ['redes']
    data.notes[1]!.content = 'TLS'
    const index = createSearchIndex(data)
    expect(
      searchEntries(index, 'protocolo #ciencia TLS').map((item) => item.id),
    ).toEqual(['example-note-0'])
    expect(searchEntries(index, '#redes TLS').map((item) => item.id)).toEqual([
      'example-note-1',
    ])
    expect(
      searchEntries(index, '#redes-seguras TLS').map((item) => item.id),
    ).toEqual(['example-note-0'])
    expect(searchEntries(index, '#ciencia ausente')).toEqual([])
    expect(searchEntries(index, '#red')).toEqual([])
  })

  it('mantém notas arquivadas encontráveis e ordena título exato, ativas e título alfabético', () => {
    const data = buildSeed(now)
    const source = data.notes[0]!
    data.notes = [
      {
        ...source,
        id: 'archived',
        title: 'Z Arquivada',
        content: 'atlas',
        archivedAt: now.toISOString(),
      },
      { ...source, id: 'b', title: 'B Aula', content: 'atlas' },
      {
        ...source,
        id: 'exact',
        title: 'Atlas',
        content: '',
        archivedAt: now.toISOString(),
      },
      { ...source, id: 'a', title: 'A Aula', content: 'atlas' },
    ]
    const index = createSearchIndex(data)
    const results = searchEntries(index, 'atlas')
    expect(
      results.filter((item) => item.type === 'notes').map((item) => item.id),
    ).toEqual(['exact', 'a', 'b', 'archived'])
    expect(results.find((item) => item.id === 'archived')).toMatchObject({
      archived: true,
    })
    expect(index.find((item) => item.id === 'a')).toMatchObject({
      archived: false,
    })
  })

  it('produz prévia curta, não busca por texto vazio e aplica limite sem mutar o índice', () => {
    const data = buildSeed(now)
    data.notes[0]!.content = `texto\n\n${'a'.repeat(200)}`
    const index = createSearchIndex(data)
    const before = structuredClone(index)
    expect(index.find((item) => item.id === 'example-note-0')?.preview).toBe(
      `texto ${'a'.repeat(154)}`,
    )
    expect(searchEntries(index, ' \n\t ')).toEqual([])
    expect(searchEntries(index, 'exemplo', 2)).toHaveLength(2)
    expect(searchEntries(index, 'exemplo', 0)).toEqual([])
    expect(index).toEqual(before)
  })

  it('desempata títulos idênticos por ID de forma determinística', () => {
    const data = buildSeed(now)
    const source = data.notes[0]!
    data.notes = ['z', 'a', 'm'].map((id) => ({
      ...source,
      id,
      title: 'Mesmo nome',
    }))
    expect(
      searchEntries(createSearchIndex(data), 'Mesmo nome').map(
        (item) => item.id,
      ),
    ).toEqual(['a', 'm', 'z'])
  })

  it('cria destinos para cada módulo com parâmetros escapados', () => {
    const index = createSearchIndex(buildSeed(now))
    const destinations = index.map((entry) => [entry.type, searchHref(entry)])
    expect(destinations).toContainEqual(['notes', '/notas?note=example-note-0'])
    expect(destinations).toContainEqual([
      'habits',
      '/habitos?habit=example-habit-0',
    ])
    expect(destinations).toContainEqual([
      'tasks',
      '/tarefas?search=Revisar%20estruturas%20de%20dados',
    ])
    expect(destinations).toContainEqual(['goals', '/metas#record-example-goal'])
    expect(destinations).toContainEqual([
      'projects',
      '/metas#record-example-project',
    ])
  })
})
