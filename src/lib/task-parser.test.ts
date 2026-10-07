import { describe, expect, it } from 'vitest'
import { parseTaskInput } from './task-parser'

const thursday = new Date(2026, 9, 1, 0, 10)

describe('parseTaskInput', () => {
  it('captures the Portuguese quick-entry example', () => {
    expect(
      parseTaskInput('estudar AWS amanhã 19h #faculdade !alta', thursday),
    ).toEqual({
      title: 'estudar AWS',
      dueDate: '2026-10-02',
      dueTime: '19:00',
      priority: 'high',
      tags: ['faculdade'],
      warnings: [],
    })
  })

  it.each([
    ['hoje', '2026-10-01'],
    ['amanha', '2026-10-02'],
    ['AMANHÃ', '2026-10-02'],
    ['depois de amanhã', '2026-10-03'],
    ['depois de amanha', '2026-10-03'],
    ['quinta', '2026-10-01'],
    ['próxima quinta-feira', '2026-10-08'],
    ['na terça-feira', '2026-10-06'],
    ['sábado', '2026-10-03'],
    ['domingo', '2026-10-04'],
    ['02/10', '2026-10-02'],
    ['1/1/2027', '2027-01-01'],
    ['2026-12-31', '2026-12-31'],
    ['29/02/2028', '2028-02-29'],
  ])('interprets %s as a local date', (expression, expected) => {
    const result = parseTaskInput(`Revisar ${expression}`, thursday)
    expect(result.title).toBe('Revisar')
    expect(result.dueDate).toBe(expected)
    expect(result.warnings).toEqual([])
  })

  it.each([
    ['19h', '19:00'],
    ['19h30', '19:30'],
    ['9:05', '09:05'],
    ['às 00h', '00:00'],
    ['as 23:59', '23:59'],
  ])(
    'interprets %s and defaults time-only tasks to today',
    (expression, expected) => {
      const result = parseTaskInput(`Revisar ${expression}`, thursday)
      expect(result.title).toBe('Revisar')
      expect(result.dueDate).toBe('2026-10-01')
      expect(result.dueTime).toBe(expected)
      expect(result.warnings).toEqual([])
    },
  )

  it('keeps calendar arithmetic local across year boundaries', () => {
    const result = parseTaskInput(
      'Revisar depois de amanhã às 19h30',
      new Date(2026, 11, 31, 23, 59),
    )
    expect(result.dueDate).toBe('2027-01-02')
    expect(result.dueTime).toBe('19:30')
    expect(result.title).toBe('Revisar')
  })

  it.each(['!media', '!média', '!MÉDIA'])(
    'recognizes the medium priority %s',
    (priority) => {
      const result = parseTaskInput(`Revisar ${priority}`, thursday)
      expect(result.priority).toBe('medium')
      expect(result.title).toBe('Revisar')
      expect(result.warnings).toEqual([])
    },
  )

  it('uses neutral defaults and preserves normal prose', () => {
    expect(
      parseTaskInput('  Ler   capítulo 2: fundamentos.  ', thursday),
    ).toEqual({
      title: 'Ler capítulo 2: fundamentos.',
      dueDate: null,
      dueTime: null,
      priority: 'medium',
      tags: [],
      warnings: [],
    })
  })

  it('deduplicates tags without changing their order', () => {
    const result = parseTaskInput(
      'Revisar #Faculdade #trabalho #FACULDADE #ciência',
      thursday,
    )
    expect(result.tags).toEqual(['faculdade', 'trabalho', 'ciência'])
    expect(result.title).toBe('Revisar')
  })

  it('preserves semantically different accents while canonicalizing Unicode tags', () => {
    const result = parseTaskInput(
      'Visitar #avó #avô #AVÓ #ciência #ciência',
      thursday,
    )
    expect(result.tags).toEqual(['avó', 'avô', 'ciência'])
    expect(result.title).toBe('Visitar')
    expect(result.warnings).toEqual([])
  })

  it.each([
    'constructor',
    '__proto__',
    'toString',
    'CSS19h',
    'amanhãzinha',
    'quintal',
  ])(
    'keeps ordinary word %s instead of extracting partial metadata',
    (word) => {
      expect(parseTaskInput(`Estudar ${word}`, thursday)).toEqual({
        title: `Estudar ${word}`,
        dueDate: null,
        dueTime: null,
        priority: 'medium',
        tags: [],
        warnings: [],
      })
    },
  )

  it('accepts metadata sentence punctuation', () => {
    const result = parseTaskInput(
      'Revisar amanhã, 19h. #faculdade; !alta!',
      thursday,
    )
    expect(result.title).toBe('Revisar')
    expect(result.dueDate).toBe('2026-10-02')
    expect(result.dueTime).toBe('19:00')
    expect(result.tags).toEqual(['faculdade'])
    expect(result.priority).toBe('high')
  })

  it.each([
    '31/02/2026',
    '29/02/2027',
    '2026-13-01',
    '2026-02-30',
    '2026-2-01',
    '02/10/26',
    '24h',
    '19h60',
    '19h5',
    '123:00',
    '!urgente',
    '!constructor',
    '!__proto__',
    '!toString',
    '!',
    '#duas#tags',
    '#',
  ])('preserves invalid token %s and explains its correction', (token) => {
    const result = parseTaskInput(`Revisar ${token}`, thursday)
    expect(result.title).toBe(`Revisar ${token}`)
    expect(result.dueTime).toBeNull()
    expect(result.dueDate).toBeNull()
    expect(result.warnings).toHaveLength(1)
  })

  it('preserves entire conflicting date phrases, times and priorities', () => {
    const result = parseTaskInput(
      'Revisar hoje depois de amanhã 19h às 20h !alta !baixa',
      thursday,
    )
    expect(result.title).toBe('Revisar depois de amanhã às 20h !baixa')
    expect(result.dueDate).toBe('2026-10-01')
    expect(result.dueTime).toBe('19:00')
    expect(result.priority).toBe('high')
    expect(result.warnings).toHaveLength(3)
  })

  it('continues processing valid tokens after invalid metadata without losing text', () => {
    const result = parseTaskInput(
      'Estudar 31/02/2026 #duas#tags !urgente amanhã 19h !baixa #projetos',
      thursday,
    )
    expect(result.title).toBe('Estudar 31/02/2026 #duas#tags !urgente')
    expect(result.dueDate).toBe('2026-10-02')
    expect(result.dueTime).toBe('19:00')
    expect(result.priority).toBe('low')
    expect(result.tags).toEqual(['projetos'])
    expect(result.warnings).toHaveLength(3)
  })

  it('leaves past explicit dates available for correcting overdue tasks', () => {
    expect(parseTaskInput('Entrega 01/09', thursday).dueDate).toBe('2026-09-01')
  })

  it('returns an empty title when only metadata or whitespace is entered', () => {
    expect(parseTaskInput('amanhã 19h !alta #faculdade', thursday).title).toBe(
      '',
    )
    expect(parseTaskInput('   ', thursday).title).toBe('')
  })

  it('preserves tags beyond the schema limit in the title', () => {
    const tags = Array.from({ length: 51 }, (_, index) => `#tag${index}`)
    const result = parseTaskInput(`Revisar ${tags.join(' ')}`, thursday)
    expect(result.tags).toHaveLength(50)
    expect(result.title).toBe('Revisar #tag50')
    expect(result.warnings).toHaveLength(1)
  })

  it('rejects an invalid reference date rather than inventing a deadline', () => {
    expect(() =>
      parseTaskInput('Revisar amanhã', new Date(Number.NaN)),
    ).toThrow(RangeError)
  })
})
