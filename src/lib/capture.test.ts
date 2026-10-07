import { describe, expect, it } from 'vitest'
import { createCapturedEntity, parseCapture } from './capture'
import { parseTaskInput } from './task-parser'

const now = new Date(2026, 9, 1, 23, 55)

describe('captura por prefixo', () => {
  it('mantém o parser completo de tarefas por padrão e com prefixo explícito', () => {
    const input = 'estudar AWS amanhã 19h #faculdade !alta'
    const parsed = parseTaskInput(input, now)
    expect(parseCapture(input, now)).toEqual({ kind: 'task', parsed })
    expect(parseCapture(` TAREFA : ${input}`, now)).toEqual({
      kind: 'task',
      parsed,
    })
    expect(parsed).toMatchObject({
      title: 'estudar AWS',
      dueDate: '2026-10-02',
      dueTime: '19:00',
      tags: ['faculdade'],
      priority: 'high',
    })
  })

  it.each(['nota:', 'NOTA :', 'nóta:'])(
    'extrai só tags das notas com prefixo %s',
    (prefix) => {
      expect(
        parseCapture(`${prefix} amanhã 19h !alta, #Pessoal #pessoal`, now),
      ).toEqual({ kind: 'note', title: 'amanhã 19h !alta,', tags: ['pessoal'] })
    },
  )

  it.each(['hábito:', 'habito:', 'HÁBITO :', 'HA\u0301BITO:'])(
    'tolera acento e caixa no prefixo %s',
    (prefix) => {
      expect(
        parseCapture(`${prefix} Ler na segunda às 19h !baixa #Leitura`, now),
      ).toEqual({
        kind: 'habit',
        title: 'Ler na segunda às 19h !baixa',
        tags: ['leitura'],
      })
    },
  )

  it('preserva prefixo desconhecido e dois-pontos internos como texto de tarefa', () => {
    expect(parseCapture('ideia: construir Atlas', now)).toEqual({
      kind: 'task',
      parsed: parseTaskInput('ideia: construir Atlas', now),
    })
    expect(parseCapture('nota: Reunião: amanhã', now)).toEqual({
      kind: 'note',
      title: 'Reunião: amanhã',
      tags: [],
    })
  })

  it('normaliza tags Unicode, mantém tags inválidas e pontuação comum na prosa', () => {
    expect(
      parseCapture(
        'nota: C# amanhã! #São-paulo, #Sa\u0303o-paulo #_errada #tag@ruim',
        now,
      ),
    ).toEqual({
      kind: 'note',
      title: 'C# amanhã! #_errada #tag@ruim',
      tags: ['são-paulo'],
    })
  })

  it('preserva tags excedentes ou longas no texto sem perder informação', () => {
    const fifty = Array.from({ length: 50 }, (_, index) => `#tag${index}`).join(
      ' ',
    )
    const long = `#${'a'.repeat(61)}`
    const result = parseCapture(`nota: Registro ${fifty} #extra ${long}`, now)
    expect(result).toMatchObject({
      kind: 'note',
      title: `Registro #extra ${long}`,
    })
    if (result.kind === 'task') throw new Error('Esperava uma nota')
    expect(result.tags).toHaveLength(50)
  })

  it('deixa título vazio para validação contextual e rejeita referência de data inválida', () => {
    expect(parseCapture('nota: #estudos', now)).toEqual({
      kind: 'note',
      title: '',
      tags: ['estudos'],
    })
    expect(() => parseCapture('hábito: Ler', new Date('invalid'))).toThrow(
      RangeError,
    )
  })
})

describe('entidades capturadas', () => {
  it('cria tarefa com defaults locais e sem prazo quando não há metadados de data', () => {
    const result = createCapturedEntity(
      parseCapture('Revisar grafos', now),
      now,
      'task-id',
    )
    expect(result).toEqual({
      collection: 'tasks',
      item: {
        id: 'task-id',
        title: 'Revisar grafos',
        status: 'todo',
        priority: 'medium',
        dueDate: null,
        dueTime: null,
        context: null,
        subtasks: [],
        repeat: null,
        focusMinutes: 0,
        tags: [],
        links: [],
        isExample: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    })
  })

  it('preserva campos e avisos de preview sem persistir warnings no modelo de tarefa', () => {
    const parsed = parseCapture('Estudar amanhã 19h !alta #AWS 31/02', now)
    const before = structuredClone(parsed)
    const result = createCapturedEntity(parsed, now, 'metadata-task')
    expect(result.collection).toBe('tasks')
    expect(result.item).toMatchObject({
      title: 'Estudar 31/02',
      dueDate: '2026-10-02',
      dueTime: '19:00',
      priority: 'high',
      tags: ['aws'],
    })
    expect(result.item).not.toHaveProperty('warnings')
    expect(parsed).toEqual(before)
    if (parsed.kind !== 'task') throw new Error('Esperava uma tarefa')
    expect(parsed.parsed.warnings).toHaveLength(1)
  })

  it('cria nota vazia e hábito binário diário sem configurar campos extras', () => {
    const capturedNote = createCapturedEntity(
      parseCapture('nota: Amanhã 19h #Aula', now),
      now,
      'note-id',
    )
    expect(capturedNote).toEqual({
      collection: 'notes',
      item: {
        id: 'note-id',
        title: 'Amanhã 19h',
        content: '',
        tags: ['aula'],
        links: [],
        isExample: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    })
    const capturedHabit = createCapturedEntity(
      parseCapture('hábito: Ler #Leitura', now),
      now,
      'habit-id',
    )
    expect(capturedHabit).toEqual({
      collection: 'habits',
      item: {
        id: 'habit-id',
        title: 'Ler',
        kind: 'binary',
        target: 1,
        unit: 'vez',
        timesPerWeek: 7,
        tags: ['leitura'],
        links: [],
        isExample: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    })
  })

  it('não compartilha arrays mutáveis entre preview e entidade criada', () => {
    const parsed = parseCapture('nota: Uma ideia #Pessoal', now)
    const result = createCapturedEntity(parsed, now, 'note-id')
    result.item.tags.push('extra')
    expect(parsed).toMatchObject({ tags: ['pessoal'] })
    expect(createCapturedEntity(parsed, now, 'note-next').item.tags).toEqual([
      'pessoal',
    ])
  })

  it.each(['', 'nota:', 'hábito: #leitura', 'tarefa: #aws !alta'])(
    'rejeita captura sem nome antes de persistir: %s',
    (input) => {
      expect(() =>
        createCapturedEntity(parseCapture(input, now), now, 'id'),
      ).toThrow()
    },
  )

  it('rejeita título extenso, ID inválido e data inválida mantendo o preview intacto', () => {
    const parsed = parseCapture(`nota: ${'a'.repeat(241)}`, now)
    const before = structuredClone(parsed)
    expect(() => createCapturedEntity(parsed, now, 'note-id')).toThrow()
    expect(parsed).toEqual(before)
    expect(() =>
      createCapturedEntity(parseCapture('Ler', now), now, 'bad id'),
    ).toThrow()
    expect(() =>
      createCapturedEntity(parseCapture('Ler', now), new Date('invalid'), 'id'),
    ).toThrow(RangeError)
  })
})
