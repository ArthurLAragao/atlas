import { describe, expect, it } from 'vitest'
import { emptySnapshot, type Note } from '../data/models'
import { buildSeed } from '../data/seed'
import {
  removableExamples,
  subtractSnapshot,
  validateSnapshot,
} from './data-integrity'

const now = new Date('2026-10-02T12:00:00Z')
const note = (
  id: string,
  title: string,
  content: string,
  isExample = true,
): Note => ({
  id,
  title,
  content,
  tags: [],
  links: [],
  isExample,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
})

describe('proteção de exemplos referenciados por links internos', () => {
  it('preserva alvo, cadeia de notas e vínculos tradicionais de uma nota pessoal', () => {
    const data = buildSeed(now)
    data.notes.push(
      note(
        'personal',
        'Minha aula',
        `Veja [[${data.notes[0]!.title.toLocaleUpperCase('pt-BR')}]].`,
        false,
      ),
    )
    const before = structuredClone(data)
    const removed = removableExamples(data)
    expect(removed.notes).toEqual([])
    expect(removed.projects.map((item) => item.id)).toEqual([
      'example-project-learning',
    ])
    expect(removed.tasks).toHaveLength(3)
    expect(removed.habits).toHaveLength(6)
    expect(removed.goals).toHaveLength(1)
    const remaining = validateSnapshot(subtractSnapshot(data, removed))
    expect(remaining.notes.map((item) => item.id)).toEqual([
      'example-note-0',
      'example-note-1',
      'personal',
    ])
    expect(remaining.projects.map((item) => item.id)).toEqual([
      'example-project',
    ])
    expect(data).toEqual(before)
  })

  it.each([
    '`[[Exemplo]]`',
    '```md\n[[Exemplo]]\n```',
    String.raw`\[[Exemplo]]`,
    '[Veja [[Exemplo]]](https://example.com)',
    '<div>\n[[Exemplo]]\n</div>',
  ])(
    'código, escapes e sintaxe excluída não prendem exemplos: %j',
    (content) => {
      const data = emptySnapshot()
      data.notes = [
        note('example', 'Exemplo', ''),
        note('personal', 'Minha nota', content, false),
      ]
      expect(removableExamples(data).notes.map((item) => item.id)).toEqual([
        'example',
      ])
      expect(
        subtractSnapshot(data, removableExamples(data)).notes.map(
          (item) => item.id,
        ),
      ).toEqual(['personal'])
    },
  )

  it('nomes ambíguos não escolhem um exemplo arbitrariamente', () => {
    const data = emptySnapshot()
    data.notes = [
      note('first', 'Exemplo', ''),
      note('second', ' EXEMPLO ', ''),
      note('personal', 'Minha nota', '[[Exemplo]]', false),
    ]
    expect(removableExamples(data).notes.map((item) => item.id)).toEqual([
      'first',
      'second',
    ])
  })

  it('termina ciclos, preservando só exemplos alcançáveis por notas pessoais', () => {
    const data = emptySnapshot()
    data.notes = [
      note('a', 'A', '[[B]]'),
      note('b', 'B', '[[A]]'),
      note('orphan-a', 'C', '[[D]]'),
      note('orphan-b', 'D', '[[C]]'),
      note('personal', 'Minha nota', '[[A]] [[A]]', false),
    ]
    expect(removableExamples(data).notes.map((item) => item.id)).toEqual([
      'orphan-a',
      'orphan-b',
    ])
  })

  it('uma nota pessoal arquivada continua protegendo suas referências', () => {
    const data = emptySnapshot()
    data.notes = [
      note('target', 'Conhecimento', ''),
      {
        ...note('personal', 'Minha nota', '[[Conhecimento]]', false),
        archivedAt: now.toISOString(),
      },
    ]
    expect(removableExamples(data).notes).toEqual([])
  })
})
