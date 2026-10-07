import { describe, expect, it } from 'vitest'
import { buildSeed } from './seed'
import { subjectSchema, studyPathSchema } from './models'
import {
  decodeBackup,
  encodeBackup,
  encodeMarkdown,
  parseImport,
} from '../lib/transfer'
import {
  references,
  removableExamples,
  subtractSnapshot,
  validateSnapshot,
} from '../lib/data-integrity'

describe('modelos de Estudos e compatibilidade', () => {
  it('lê backups anteriores sem as novas coleções', () => {
    const backup = JSON.parse(encodeBackup(buildSeed())) as {
      data: Record<string, unknown>
    }
    delete backup.data.subjects
    delete backup.data.studyPaths
    const data = decodeBackup(JSON.stringify(backup))
    expect(data.subjects).toEqual([])
    expect(data.studyPaths).toEqual([])
    expect(data.tasks).toHaveLength(3)
  })
  it.each(['json', 'md'])(
    'preserva avaliações, faltas e referências em %s',
    (format) => {
      const data = buildSeed()
      data.subjects[0]!.assessments = [
        {
          id: 'assessment',
          title: 'Prova',
          weight: 2,
          score: 8,
          maxScore: 10,
          date: '2026-10-15',
          notes: 'Revisar árvores',
        },
      ]
      data.subjects[0]!.events = [
        {
          id: 'event',
          title: 'Entrega',
          kind: 'delivery',
          date: '2026-10-20',
          status: 'pending',
          description: 'Lista',
          taskId: data.tasks[0]!.id,
        },
      ]
      data.subjects[0]!.absences = 3
      data.studyPaths[0]!.steps[0]!.noteId = data.notes[0]!.id
      data.studyPaths[0]!.steps[0]!.taskId = data.tasks[1]!.id
      const encoded =
        format === 'json' ? encodeBackup(data) : encodeMarkdown(data)
      expect(parseImport(encoded, `backup.${format}`)).toEqual(data)
    },
  )
  it.each([
    { score: -1, maxScore: 10, weight: null },
    { score: 11, maxScore: 10, weight: null },
    { score: 1, maxScore: 0, weight: null },
    { score: 1, maxScore: 10, weight: 0 },
    { score: 1, maxScore: 10, weight: -1 },
    { score: 1, maxScore: 10, weight: Infinity },
  ])('rejeita medidas inválidas sem coerção: %j', (measures) => {
    expect(
      subjectSchema.safeParse({
        ...buildSeed().subjects[0]!,
        assessments: [
          { id: 'a', title: 'P1', date: null, notes: '', ...measures },
        ],
      }).success,
    ).toBe(false)
  })
  it('rejeita IDs repetidos e URLs executáveis', () => {
    const path = buildSeed().studyPaths[0]!
    expect(
      studyPathSchema.safeParse({
        ...path,
        steps: [path.steps[0]!, path.steps[0]!],
      }).success,
    ).toBe(false)
    expect(
      studyPathSchema.safeParse({
        ...path,
        steps: [{ ...path.steps[0]!, url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false)
  })
  it('rejeita provas ou etapas apontando a registros ausentes', () => {
    const data = buildSeed()
    data.subjects[0]!.events = [
      {
        id: 'e',
        title: 'Prova',
        kind: 'exam',
        date: '2026-10-15',
        status: 'pending',
        description: '',
        taskId: 'missing',
      },
    ]
    expect(() => validateSnapshot(data)).toThrow(/tarefa ausente/)
    data.subjects[0]!.events = []
    data.studyPaths[0]!.steps[0]!.noteId = 'missing'
    expect(() => validateSnapshot(data)).toThrow(/nota ausente/)
  })
  it('dependências embutidas pessoais protegem os exemplos de tarefa e nota', () => {
    const data = buildSeed()
    data.studyPaths[0]!.isExample = false
    data.studyPaths[0]!.steps[0]!.taskId = data.tasks[0]!.id
    data.studyPaths[0]!.steps[0]!.noteId = data.notes[0]!.id
    expect(references(data.studyPaths[0]!)).toContain(data.tasks[0]!.id)
    const kept = validateSnapshot(
      subtractSnapshot(data, removableExamples(data)),
    )
    expect(kept.studyPaths).toHaveLength(1)
    expect(kept.tasks).toHaveLength(1)
    expect(kept.notes).toHaveLength(2) // Includes the linked note's wiki dependency.
    expect(kept.subjects).toEqual([])
  })
})
