import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { emptySnapshot } from '../data/models'
import {
  encodeBackup,
  encodeMarkdown,
  parseImport,
  decodeBackup,
  maxImportBytes,
} from './transfer'
import {
  mergeSnapshots,
  recordCount,
  removableExamples,
  subtractSnapshot,
  validateSnapshot,
} from './data-integrity'

const now = new Date('2026-10-01T12:00:00Z')

describe('backup e importação', () => {
  it('faz round-trip JSON completo de todos os modelos e vínculos', () => {
    const data = buildSeed(now)
    expect(decodeBackup(encodeBackup(data, now))).toEqual(data)
    expect(recordCount(data)).toBe(20) // Includes subjects and study paths in full backups.
  })
  it('faz round-trip Markdown inclusive cercas, Unicode e conteúdo parecido com metadados', () => {
    const data = buildSeed(now)
    data.notes[0]!.content =
      '# Ação e água\n```json\n{}\n```\n<!-- ATLAS_BACKUP_V1 -->\n<script>alert(1)</script>'
    expect(parseImport(encodeMarkdown(data, now), 'atlas.md')).toEqual(data)
  })
  it('importa Markdown comum como nota, sem executar HTML', () => {
    const result = parseImport(
      '\uFEFF# Minha aula\n\n<script>alert(1)</script>',
      'aula.md',
      now,
      'note-user',
    )
    expect(result.notes[0]).toMatchObject({
      id: 'note-user',
      title: 'Minha aula',
      isExample: false,
      content: '# Minha aula\n\n<script>alert(1)</script>',
    })
  })
  it.each([
    ['{broken', 'atlas.json'],
    ['{}', 'atlas.json'],
    ['texto', 'atlas.exe'],
    ['', 'aula.md'],
    ['<!-- ATLAS_BACKUP_V1 -->\n```json\n{}', 'atlas.md'],
  ])(
    'rejeita arquivo inválido sem transformá-lo em registro',
    (text, filename) => {
      expect(() => parseImport(text, filename)).toThrow()
    },
  )
  it('rejeita versão futura e arquivo grande', () => {
    expect(() =>
      decodeBackup(
        encodeBackup(buildSeed(now)).replace(
          '"schemaVersion": 1',
          '"schemaVersion": 2',
        ),
      ),
    ).toThrow(/versão/)
    expect(() =>
      parseImport('x'.repeat(maxImportBytes + 1), 'grande.md'),
    ).toThrow(/5 MB/)
  })
  it('preserva IDs, não duplica reimportações e não transforma importados em exemplos', () => {
    const seed = buildSeed(now)
    const first = mergeSnapshots(emptySnapshot(), seed)
    expect(first.added).toBe(20)
    expect(first.data.notes.every((item) => !item.isExample)).toBe(true)
    const second = mergeSnapshots(first.data, seed)
    expect(second.added).toBe(0)
    expect(second.skipped).toBe(20)
    expect(second.data).toEqual(first.data)
  })
  it('preserva o conteúdo atual quando o backup tem o mesmo ID', () => {
    const current = buildSeed(now)
    current.notes[0]!.content = 'Minha edição'
    expect(mergeSnapshots(current, buildSeed(now)).data.notes[0]!.content).toBe(
      'Minha edição',
    )
  })
  it('preserva exemplos referenciados por registros pessoais, inclusive dependências transitivas', () => {
    const data = buildSeed(now)
    data.notes[0]!.isExample = false
    // This case isolates explicit links; wiki dependencies have their own tests.
    data.notes[0]!.content = 'Registro pessoal com um vínculo explícito.'
    data.notes[0]!.links = [{ type: 'tasks', id: 'example-task-0' }]
    const removed = removableExamples(data)
    const remaining = validateSnapshot(subtractSnapshot(data, removed))
    expect(remaining.tasks).toHaveLength(1)
    expect(remaining.projects).toHaveLength(1)
    expect(remaining.goals).toHaveLength(1)
    expect(remaining.notes).toHaveLength(1)
  })
})

describe('integridade dos registros', () => {
  it('rejeita referências ausentes, IDs repetidos, datas inválidas e URL executável', () => {
    const invalidLink = buildSeed(now)
    invalidLink.tasks[0]!.links.push({ type: 'notes', id: 'missing' })
    expect(() => validateSnapshot(invalidLink)).toThrow(/vínculos/)
    const duplicate = buildSeed(now)
    duplicate.notes.push(duplicate.notes[0]!)
    expect(() => validateSnapshot(duplicate)).toThrow(/IDs repetidos/)
    const date = buildSeed(now)
    date.tasks[0]!.dueDate = '2026-02-30'
    expect(() => validateSnapshot(date)).toThrow(/inválidos/)
    const url = buildSeed(now)
    url.projects[0]!.repositoryUrl = 'javascript:alert(1)'
    expect(() => validateSnapshot(url)).toThrow(/inválidos/)
  })
  it('rejeita registros órfãos e dois logs do mesmo hábito/dia', () => {
    const orphan = buildSeed(now)
    orphan.habitLogs[0]!.habitId = 'absent'
    expect(() => validateSnapshot(orphan)).toThrow(/hábito correspondente/)
    const duplicate = buildSeed(now)
    duplicate.habitLogs.push({ ...duplicate.habitLogs[0]!, id: 'different-id' })
    expect(() => validateSnapshot(duplicate)).toThrow(/mesmo dia/)
  })
  it('rejeita colisão de IDs entre tipos e ignora log já existente por hábito/dia', () => {
    const current = buildSeed(now)
    const incoming = buildSeed(now)
    incoming.notes[0]!.id = 'example-task-0'
    expect(() => mergeSnapshots(current, incoming)).toThrow(/outro tipo/)
    incoming.notes[0]!.id = 'example-note-0'
    incoming.habitLogs[0]!.id = 'new-log-id'
    expect(mergeSnapshots(current, incoming).skipped).toBe(20)
  })
})
