import { describe, expect, it } from 'vitest'
import { createCapturedEntity, parseCapture } from './capture'

const now = new Date('2026-10-02T12:00:00Z')

describe('validação de títulos de notas capturadas', () => {
  it.each([
    'nota: [[Teste]]',
    'nota: Antes [[ depois',
    'nota: Antes ]] depois',
  ])(
    'permite preview, mas recusa persistência de título com sintaxe reservada: %s',
    (input) => {
      expect(() => parseCapture(input, now)).not.toThrow()
      const parsed = parseCapture(input, now)
      const before = structuredClone(parsed)
      expect(parsed.kind).toBe('note')
      expect(() => createCapturedEntity(parsed, now, 'invalid-note')).toThrow()
      expect(parsed).toEqual(before)
    },
  )

  it('recusa quebra de linha mesmo se uma chamada direta fornece o título à factory', () => {
    expect(() =>
      createCapturedEntity(
        { kind: 'note', title: 'Uma nota\nOutra linha', tags: [] },
        now,
        'invalid-note',
      ),
    ).toThrow()
  })

  it('mantém captura de notas comuns e não aplica restrições de títulos de notas a outros tipos', () => {
    const captured = createCapturedEntity(
      parseCapture('nota: Ciência: uma ideia #faculdade', now),
      now,
      'valid-note',
    )
    expect(captured).toMatchObject({
      collection: 'notes',
      item: { title: 'Ciência: uma ideia', content: '', tags: ['faculdade'] },
    })
    expect(
      createCapturedEntity(
        parseCapture('tarefa: Revisar [[links]]', now),
        now,
        'valid-task',
      ).collection,
    ).toBe('tasks')
    expect(
      createCapturedEntity(
        parseCapture('hábito: Praticar [[links]]', now),
        now,
        'valid-habit',
      ).collection,
    ).toBe('habits')
  })
})
