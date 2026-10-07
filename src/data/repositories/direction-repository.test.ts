import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import {
  collections,
  emptySnapshot,
  type Goal,
  type Note,
  type Project,
  type Snapshot,
  type Task,
} from '../models'
import { buildSeed } from '../seed'
import { recordCount, validateSnapshot } from '../../lib/data-integrity'
import { DexieAtlasRepository } from './dexie-repository'

let repository: DexieAtlasRepository
const original = '2020-01-01T00:00:00.000Z'
const base = (id: string) => ({
  id,
  tags: ['cloud'],
  links: [],
  isExample: true,
  createdAt: original,
  updatedAt: original,
})
const goal = (id = 'goal'): Goal => ({
  ...base(id),
  title: 'Concluir trilha AWS',
  description: 'Praticar e documentar.',
  status: 'active',
  weekly: false,
  deadline: '2026-10-10',
  keyResults: [
    {
      id: `${id}-modules`,
      title: 'Completar módulos',
      current: 3,
      target: 10,
      unit: 'módulos',
    },
    {
      id: `${id}-hours`,
      title: 'Horas de estudo',
      current: 8,
      target: 30,
      unit: 'h',
    },
  ],
})
const project = (id = 'project'): Project => ({
  ...base(id),
  title: 'Atlas',
  description: 'Centro pessoal.',
  status: 'active',
  repositoryUrl: 'https://example.com/atlas',
  urls: [{ title: 'Documentação', url: 'https://example.com/docs' }],
})
const task = (id = 'task'): Task => ({
  ...base(id),
  title: 'Estudar AWS',
  status: 'todo',
  priority: 'high',
  dueDate: null,
  dueTime: null,
  context: 'Projetos',
  subtasks: [],
  repeat: null,
  focusMinutes: 0,
})
const note = (id = 'note'): Note => ({
  ...base(id),
  title: 'Descobertas AWS',
  content: '# Descobertas\n\nTexto.',
  archivedAt: null,
})
async function insert(input: Partial<Snapshot>) {
  const data = validateSnapshot({ ...emptySnapshot(), ...input })
  await repository.database.transaction(
    'rw',
    repository.database.tables,
    async () => {
      for (const name of collections)
        await repository.database.table(name).bulkPut(data[name])
    },
  )
  return data
}
const withoutVersion = <T extends { updatedAt: string }>(record: T) => ({
  ...record,
  updatedAt: original,
})

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 9, 2, 12))
  repository = new DexieAtlasRepository(
    createDatabase(`atlas-directions-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await repository.database.delete()
})

describe('salvar metas e projetos sem perda de progresso', () => {
  it('cria registros com campos, URL, resultados-chave e criação preservados', async () => {
    const g = await repository.saveDirection('goals', goal(), null)
    const p = await repository.saveDirection('projects', project(), null)
    expect(g.saved).toEqual({
      ...goal(),
      isExample: false,
      updatedAt: new Date().toISOString(),
    })
    expect(p.saved).toEqual({
      ...project(),
      isExample: false,
      updatedAt: new Date().toISOString(),
    })
    expect(await repository.snapshot()).toEqual(p.data)
  })
  it('editar não altera valores manuais nem campos de relacionamentos existentes', async () => {
    const oldGoal = {
      ...goal(),
      links: [{ type: 'tasks' as const, id: 'task' }],
    }
    await insert({ goals: [oldGoal], tasks: [task()] })
    const result = await repository.saveDirection(
      'goals',
      {
        ...oldGoal,
        title: 'Objetivo atualizado',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      original,
    )
    expect(result.saved.keyResults).toEqual(oldGoal.keyResults)
    expect(result.saved.links).toEqual(oldGoal.links)
    expect(result.saved.createdAt).toBe(original)
  })
  it('versão avança em duas gravações no mesmo milissegundo e rejeita aba obsoleta', async () => {
    const first = (await repository.saveDirection('goals', goal(), null)).saved
    const second = (
      await repository.saveDirection(
        'goals',
        { ...first, title: 'Segunda edição' },
        first.updatedAt,
      )
    ).saved
    expect(Date.parse(second.updatedAt)).toBeGreaterThan(
      Date.parse(first.updatedAt),
    )
    await expect(
      repository.saveDirection(
        'goals',
        { ...first, title: 'Aba antiga' },
        first.updatedAt,
      ),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.get('goals', first.id)).toEqual(second)
  })
  it('serializa edições concorrentes e recusa reutilizar IDs existentes', async () => {
    await insert({ goals: [goal()], tasks: [task()] })
    const outcomes = await Promise.allSettled([
      repository.saveDirection(
        'goals',
        { ...goal(), title: 'Primeira' },
        original,
      ),
      repository.saveDirection(
        'goals',
        { ...goal(), title: 'Segunda' },
        original,
      ),
    ])
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(1)
    const current = await repository.snapshot()
    await expect(
      repository.saveDirection('goals', goal(), null),
    ).rejects.toThrow(/outra aba/)
    await expect(
      repository.saveDirection('projects', project('task'), null),
    ).rejects.toThrow(/IDs repetidos/)
    expect(await repository.snapshot()).toEqual(current)
  })
  it('preserva criação futura com versão válida e normaliza campos pelos schemas', async () => {
    const future = '2030-01-01T00:00:00.000Z'
    const result = await repository.saveDirection(
      'projects',
      {
        ...project(),
        title: '  Atlas  ',
        createdAt: future,
        updatedAt: future,
      },
      null,
    )
    expect(result.saved.title).toBe('Atlas')
    expect(result.saved.updatedAt).toBe(future)
  })
  it('recusa links ausentes e URL insegura sem gravação parcial', async () => {
    await expect(
      repository.saveDirection(
        'goals',
        { ...goal(), links: [{ type: 'tasks', id: 'absent' }] },
        null,
      ),
    ).rejects.toThrow(/ausentes/)
    await expect(
      repository.saveDirection(
        'projects',
        { ...project(), repositoryUrl: 'javascript:alert(1)' },
        null,
      ),
    ).rejects.toThrow(/Dados inválidos/)
    expect(recordCount(await repository.snapshot())).toBe(0)
  })
})

describe('escolha semanal explícita e exclusiva', () => {
  it('escolher outra meta desmarca apenas a escolha anterior sem mudar resultados', async () => {
    const old = { ...goal(), weekly: true }
    await insert({ goals: [old, goal('other')] })
    const result = await repository.saveDirection(
      'goals',
      { ...goal('other'), weekly: true },
      original,
    )
    expect(result.data.goals.find((item) => item.id === 'goal')).toEqual({
      ...old,
      weekly: false,
      updatedAt: new Date().toISOString(),
      isExample: false,
    })
    expect(result.saved.weekly).toBe(true)
    expect(result.saved.keyResults).toEqual(goal('other').keyResults)
  })
  it('o contrato genérico usado por Hoje mantém exclusividade e versão monotônica', async () => {
    await insert({ goals: [{ ...goal(), weekly: true }, goal('other')] })
    const result = await repository.save('goals', {
      ...goal('other'),
      weekly: true,
    })
    expect(
      (await repository.snapshot()).goals.filter((item) => item.weekly),
    ).toEqual([result])
    const edited = await repository.save('goals', {
      ...result,
      title: 'Semana atual',
    })
    expect(Date.parse(edited.updatedAt)).toBeGreaterThan(
      Date.parse(result.updatedAt),
    )
  })
  it('validação rejeita múltiplas escolhas não arquivadas e aceita backups legados', () => {
    expect(() =>
      validateSnapshot({
        ...emptySnapshot(),
        goals: [
          { ...goal(), weekly: true },
          { ...goal('other'), weekly: true },
        ],
      }),
    ).toThrow(/apenas uma meta/)
    expect(() =>
      validateSnapshot({
        ...emptySnapshot(),
        goals: [
          { ...goal(), weekly: true },
          { ...goal('other'), weekly: true, status: 'archived' },
        ],
      }),
    ).not.toThrow()
    const legacy = goal()
    delete legacy.status
    delete legacy.weekly
    delete legacy.description
    expect(
      validateSnapshot({ ...emptySnapshot(), goals: [legacy] }).goals,
    ).toEqual([legacy])
  })
  it('importar escolha semanal conflitante rejeita o lote completo', async () => {
    await insert({ goals: [{ ...goal(), weekly: true }] })
    const before = await repository.snapshot()
    await expect(
      repository.importData({
        ...emptySnapshot(),
        goals: [{ ...goal('other'), weekly: true }],
        notes: [note()],
      }),
    ).rejects.toThrow(/mais de uma/)
    expect(await repository.snapshot()).toEqual(before)
  })
})

describe('relações por ID em ambas as direções', () => {
  beforeEach(async () => {
    await insert({
      goals: [goal()],
      projects: [project(), project('other-project')],
      tasks: [task()],
      notes: [note()],
    })
  })
  it.each([
    ['goals', 'goal', 'tasks', 'task'],
    ['goals', 'goal', 'projects', 'project'],
    ['projects', 'project', 'tasks', 'task'],
    ['projects', 'project', 'notes', 'note'],
    ['projects', 'project', 'goals', 'goal'],
  ] as const)(
    'vincula %s a %s sem duplicar registros ou sobrescrever progresso',
    async (source, id, target, targetId) => {
      const before = await repository.snapshot()
      const result = await repository.linkDirection(
        source,
        id,
        target,
        targetId,
        true,
      )
      expect(
        result[source].find((item) => item.id === id)?.links,
      ).toContainEqual({ type: target, id: targetId })
      expect(recordCount(result)).toBe(recordCount(before))
      expect(result.goals[0]?.keyResults).toEqual(before.goals[0]?.keyResults)
      expect(
        await repository.linkDirection(source, id, target, targetId, true),
      ).toEqual(result)
      expect(await repository.snapshot()).toEqual(result)
    },
  )
  it('reconhece vínculo do lado oposto e remove todas as duplicatas de ambos os lados', async () => {
    const g = {
      ...goal(),
      links: [
        { type: 'projects' as const, id: 'project' },
        { type: 'projects' as const, id: 'project' },
      ],
    }
    const p = { ...project(), links: [{ type: 'goals' as const, id: 'goal' }] }
    await repository.database.table('goals').put(g)
    await repository.database.table('projects').put(p)
    const before = await repository.snapshot()
    expect(
      await repository.linkDirection(
        'projects',
        'project',
        'goals',
        'goal',
        true,
      ),
    ).toEqual(before)
    const result = await repository.linkDirection(
      'projects',
      'project',
      'goals',
      'goal',
      false,
    )
    expect(result.goals[0]?.links).toEqual([])
    expect(
      result.projects.find((item) => item.id === 'project')?.links,
    ).toEqual([])
    expect(result.goals[0]?.keyResults).toEqual(g.keyResults)
    expect(
      await repository.linkDirection(
        'projects',
        'project',
        'goals',
        'goal',
        false,
      ),
    ).toEqual(result)
  })
  it.each([
    ['goals', 'goal', 'notes', 'note'],
    ['goals', 'goal', 'goals', 'goal'],
    ['projects', 'project', 'projects', 'other-project'],
  ] as const)(
    'recusa relação imprópria %s/%s/%s/%s',
    async (source, id, target, targetId) => {
      const before = await repository.snapshot()
      await expect(
        repository.linkDirection(source, id, target, targetId, true),
      ).rejects.toThrow(/relação válida/)
      expect(await repository.snapshot()).toEqual(before)
    },
  )
  it('recusa IDs de tipo errado ou ausentes', async () => {
    const before = await repository.snapshot()
    await expect(
      repository.linkDirection('goals', 'goal', 'tasks', 'note', true),
    ).rejects.toThrow(/não existe/)
    await expect(
      repository.linkDirection('projects', 'missing', 'notes', 'note', true),
    ).rejects.toThrow(/não existe/)
    expect(await repository.snapshot()).toEqual(before)
  })
  it('arquivados são somente leitura e não podem receber vínculos novos', async () => {
    await repository.archiveDirection('goals', 'goal', true)
    await expect(
      repository.linkDirection('goals', 'goal', 'tasks', 'task', true),
    ).rejects.toThrow(/arquivado/)
    await expect(
      repository.linkDirection('projects', 'project', 'goals', 'goal', true),
    ).rejects.toThrow(/arquivado/)
    await repository.archiveNote('note', true)
    await expect(
      repository.linkDirection('projects', 'project', 'notes', 'note', true),
    ).rejects.toThrow(/arquivado/)
  })
})

describe('criação atômica dentro do projeto', () => {
  it.each(['tasks', 'notes'] as const)(
    'cria %s uma única vez com vínculos existentes preservados e pai intacto',
    async (name) => {
      await insert({ projects: [project()], goals: [goal()] })
      const input =
        name === 'tasks'
          ? { ...task(), links: [{ type: 'goals' as const, id: 'goal' }] }
          : { ...note(), links: [{ type: 'goals' as const, id: 'goal' }] }
      const result = await repository.createProjectItem('project', name, input)
      expect(result.created.links).toEqual([
        { type: 'goals', id: 'goal' },
        { type: 'projects', id: 'project' },
      ])
      expect(result.created.isExample).toBe(false)
      expect(result.data.projects).toEqual([project()])
      expect(result.data[name]).toHaveLength(1)
      expect(await repository.snapshot()).toEqual(result.data)
      await expect(
        repository.createProjectItem('project', name, input),
      ).rejects.toThrow(/ID já existe/)
    },
  )
  it('recusa pai ausente ou arquivado, colisão global e título wiki inválido', async () => {
    await insert({ projects: [project()], tasks: [task()] })
    await expect(
      repository.createProjectItem('missing', 'notes', note()),
    ).rejects.toThrow(/Projeto não encontrado/)
    await expect(
      repository.createProjectItem('project', 'notes', note('task')),
    ).rejects.toThrow(/ID já existe/)
    await expect(
      repository.createProjectItem('project', 'notes', {
        ...note(),
        title: '[[Inválido]]',
      }),
    ).rejects.toThrow(/título sem/)
    await repository.archiveDirection('projects', 'project', true)
    await expect(
      repository.createProjectItem('project', 'tasks', task('new')),
    ).rejects.toThrow(/arquivado/)
    expect((await repository.snapshot()).notes).toEqual([])
  })
  it('falha de escrita não anuncia confirmação nem deixa um filho parcial', async () => {
    await insert({ projects: [project()] })
    const before = await repository.snapshot()
    vi.spyOn(repository.database.table('notes'), 'put').mockRejectedValueOnce(
      new Error('Disco indisponível'),
    )
    await expect(
      repository.createProjectItem('project', 'notes', note()),
    ).rejects.toThrow(/Disco/)
    expect(await repository.snapshot()).toEqual(before)
  })
})

describe('arquivar, excluir e desfazer de forma transacional', () => {
  it('arquivo preserva resultado-chave, remove escolha semanal e undo recupera com versão nova', async () => {
    const g = { ...goal(), weekly: true, status: 'completed' as const }
    await insert({ goals: [g] })
    const archived = await repository.archiveDirection('goals', 'goal', true)
    expect(archived.goals[0]).toMatchObject({
      status: 'archived',
      archivedFrom: 'completed',
      weekly: false,
      keyResults: g.keyResults,
    })
    expect(await repository.getDirectionUndo()).toEqual({
      label: 'Arquivar Concluir trilha AWS',
      type: 'goals',
      id: 'goal',
    })
    const result = await repository.undoDirectionChange()
    expect(withoutVersion(result.goals[0]!)).toEqual(g)
    expect(Date.parse(result.goals[0]!.updatedAt)).toBeGreaterThan(
      Date.parse(archived.goals[0]!.updatedAt),
    )
    expect(await repository.getDirectionUndo()).toBeNull()
  })
  it('desarquivar recupera estado anterior e múltiplos undos persistem entre sessões', async () => {
    const p = { ...project(), status: 'paused' as const }
    await insert({ projects: [p] })
    await repository.archiveDirection('projects', 'project', true)
    await repository.archiveDirection('projects', 'project', false)
    expect((await repository.get('projects', 'project'))?.status).toBe('paused')
    repository.database.close()
    await repository.database.open()
    const undoUnarchive = await repository.undoDirectionChange()
    expect(undoUnarchive.projects[0]?.status).toBe('archived')
    const undoArchive = await repository.undoDirectionChange()
    expect(withoutVersion(undoArchive.projects[0]!)).toEqual(p)
    expect(Date.parse(undoArchive.projects[0]!.updatedAt)).toBeGreaterThan(
      Date.parse(undoUnarchive.projects[0]!.updatedAt),
    )
    expect(await repository.getDirectionUndo()).toBeNull()
  })
  it('arquivo repetido é idempotente e edição arquivada é recusada', async () => {
    await insert({ projects: [project()] })
    const result = await repository.archiveDirection(
      'projects',
      'project',
      true,
    )
    expect(
      await repository.archiveDirection('projects', 'project', true),
    ).toEqual(result)
    await expect(
      repository.saveDirection(
        'projects',
        { ...result.projects[0]!, title: 'Mudança' },
        result.projects[0]!.updatedAt,
      ),
    ).rejects.toThrow(/Desarquive/)
    await expect(
      repository.saveDirection(
        'goals',
        { ...goal(), status: 'archived' },
        null,
      ),
    ).rejects.toThrow(/ação Arquivar/)
    await repository.undoDirectionChange()
    expect(await repository.getDirectionUndo()).toBeNull()
  })
  it('excluir remove todos os vínculos recebidos e undo restaura relações e progresso manual', async () => {
    const g = {
      ...goal(),
      links: [{ type: 'projects' as const, id: 'project' }],
    }
    const p = { ...project(), links: [{ type: 'goals' as const, id: 'goal' }] }
    const t = {
      ...task(),
      links: [
        { type: 'goals' as const, id: 'goal' },
        { type: 'projects' as const, id: 'project' },
      ],
    }
    const n = { ...note(), links: [{ type: 'goals' as const, id: 'goal' }] }
    await insert({ goals: [g], projects: [p], tasks: [t], notes: [n] })
    const removed = await repository.removeDirection('goals', 'goal')
    expect(removed.goals).toEqual([])
    expect(removed.tasks[0]?.links).toEqual([
      { type: 'projects', id: 'project' },
    ])
    expect(removed.notes[0]?.links).toEqual([])
    expect(removed.projects[0]?.links).toEqual([])
    const restored = await repository.undoDirectionChange()
    expect(withoutVersion(restored.goals[0]!)).toEqual(g)
    expect(withoutVersion(restored.projects[0]!)).toEqual(p)
    expect(withoutVersion(restored.tasks[0]!)).toEqual(t)
    expect(withoutVersion(restored.notes[0]!)).toEqual(n)
  })
  it('undo preserva inserções posteriores não afetadas pela ação', async () => {
    await insert({
      projects: [project()],
      notes: [{ ...note(), links: [{ type: 'projects', id: 'project' }] }],
    })
    await repository.removeDirection('projects', 'project')
    const unrelated = await repository.saveNote(note('other'), null)
    const result = await repository.undoDirectionChange()
    expect(result.notes.find((item) => item.id === 'other')).toEqual(
      unrelated.saved,
    )
    expect(result.notes.find((item) => item.id === 'note')?.links).toEqual([
      { type: 'projects', id: 'project' },
    ])
  })
  it('undo recusa sobrescrever tarefa alterada após remover vínculos', async () => {
    await insert({
      goals: [goal()],
      tasks: [{ ...task(), links: [{ type: 'goals', id: 'goal' }] }],
    })
    await repository.removeDirection('goals', 'goal')
    await repository.setTaskStatus('task', 'done')
    const current = await repository.snapshot()
    await expect(repository.undoDirectionChange()).rejects.toThrow(
      /mudou depois/,
    )
    expect(await repository.snapshot()).toEqual(current)
    expect(await repository.getDirectionUndo()).not.toBeNull()
  })
  it('undo recusa colisão de ID global e vínculo que ficou ausente', async () => {
    await insert({
      goals: [{ ...goal(), links: [{ type: 'projects', id: 'project' }] }],
      projects: [project()],
    })
    await repository.removeDirection('goals', 'goal')
    await repository.saveNote(note('goal'), null)
    const collided = await repository.snapshot()
    await expect(repository.undoDirectionChange()).rejects.toThrow(
      /IDs repetidos/,
    )
    expect(await repository.snapshot()).toEqual(collided)
    await repository.remove('notes', 'goal')
    await repository.remove('projects', 'project')
    const missing = await repository.snapshot()
    await expect(repository.undoDirectionChange()).rejects.toThrow(/ausentes/)
    expect(await repository.snapshot()).toEqual(missing)
  })
  it('undo semanal não apaga uma escolha feita posteriormente', async () => {
    await insert({ goals: [{ ...goal(), weekly: true }, goal('other')] })
    await repository.archiveDirection('goals', 'goal', true)
    await repository.saveDirection(
      'goals',
      { ...goal('other'), weekly: true },
      original,
    )
    const current = await repository.snapshot()
    await expect(repository.undoDirectionChange()).rejects.toThrow(
      /mais de uma meta/,
    )
    expect(await repository.snapshot()).toEqual(current)
  })
  it('falha no histórico reverte exclusão e todas as alterações de vínculos', async () => {
    await insert({
      goals: [goal()],
      tasks: [{ ...task(), links: [{ type: 'goals', id: 'goal' }] }],
    })
    const current = await repository.snapshot()
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('Sem espaço'),
    )
    await expect(repository.removeDirection('goals', 'goal')).rejects.toThrow(
      /Sem espaço/,
    )
    expect(await repository.snapshot()).toEqual(current)
    expect(await repository.getDirectionUndo()).toBeNull()
  })
  it('falha durante undo reverte a restauração sem consumir histórico', async () => {
    await insert({
      projects: [project()],
      tasks: [{ ...task(), links: [{ type: 'projects', id: 'project' }] }],
    })
    await repository.removeDirection('projects', 'project')
    const current = await repository.snapshot()
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('Falha no histórico'),
    )
    await expect(repository.undoDirectionChange()).rejects.toThrow(/Falha/)
    expect(await repository.snapshot()).toEqual(current)
    expect(await repository.getDirectionUndo()).not.toBeNull()
  })
  it('desfazer vazio não cria dados e registro ausente explica como recuperar', async () => {
    expect(await repository.undoDirectionChange()).toEqual(emptySnapshot())
    await expect(
      repository.archiveDirection('goals', 'missing', true),
    ).rejects.toThrow(/Reabra a lista/)
    await expect(
      repository.removeDirection('projects', 'missing'),
    ).rejects.toThrow(/Reabra a lista/)
  })
})

describe('seed de projetos e evolução de bases existentes', () => {
  it('limpeza automática de vínculos não transforma exemplos em dados pessoais', async () => {
    await repository.initialize()
    const afterDelete = await repository.removeDirection(
      'projects',
      'example-project',
    )
    expect(afterDelete.tasks.every((item) => item.isExample)).toBe(true)
    expect(afterDelete.notes.every((item) => item.isExample)).toBe(true)
    await repository.removeExamples()
    expect(await repository.snapshot()).toEqual(emptySnapshot())
  })
  it('nova base traz Atlas e trilha AWS/DevOps como exemplos removíveis', async () => {
    await repository.initialize()
    const data = await repository.snapshot()
    expect(recordCount(data)).toBe(20) // 15 previous examples + 5 study examples.
    expect(data.projects.map((item) => [item.title, item.isExample])).toEqual([
      ['Atlas', true],
      ['Trilha AWS/DevOps', true],
    ])
    expect(
      await repository.database.table('meta').get('projectExamplesVersion'),
    ).toEqual({ key: 'projectExamplesVersion', value: 2 })
    await repository.removeExamples()
    await repository.initialize()
    expect(await repository.snapshot()).toEqual(emptySnapshot())
  })
  it('migra exemplos antigos uma só vez e preserva conteúdo pessoal', async () => {
    const old = buildSeed()
    old.projects = [
      {
        ...old.projects[0]!,
        title: 'Meu primeiro projeto no Atlas',
        description: 'Exemplo antigo',
      },
      { ...project('personal'), isExample: false },
    ]
    await insert(old)
    await repository.database
      .table('meta')
      .put({ key: 'initialized', value: true })
    await repository.initialize()
    const next = await repository.snapshot()
    expect(
      next.projects.find((item) => item.id === 'example-project')?.title,
    ).toBe('Atlas')
    expect(next.projects.find((item) => item.id === 'personal')).toEqual({
      ...project('personal'),
      isExample: false,
    })
    expect(
      next.projects.find((item) => item.id === 'example-project-learning')
        ?.isExample,
    ).toBe(true)
    await repository.initialize()
    expect(await repository.snapshot()).toEqual(next)
    await repository.remove('projects', 'example-project-learning')
    await repository.initialize()
    expect(
      (await repository.snapshot()).projects.some(
        (item) => item.id === 'example-project-learning',
      ),
    ).toBe(false)
  })
  it('não modifica um Atlas de exemplo que já virou projeto pessoal', async () => {
    const data = buildSeed()
    data.projects = [
      {
        ...data.projects[0]!,
        title: 'Meu Atlas personalizado',
        isExample: false,
      },
    ]
    await insert(data)
    await repository.database
      .table('meta')
      .put({ key: 'initialized', value: true })
    await repository.initialize()
    expect(
      (await repository.snapshot()).projects.find(
        (item) => item.id === 'example-project',
      ),
    ).toEqual(data.projects[0])
  })
  it('base pessoal sem exemplos não recebe projetos novos', async () => {
    await insert({ notes: [{ ...note(), isExample: false }] })
    await repository.database
      .table('meta')
      .put({ key: 'initialized', value: true })
    await repository.initialize()
    expect((await repository.snapshot()).projects).toEqual([])
  })
  it('remoção anterior de exemplos impede reinserção mesmo com um exemplo protegido', async () => {
    const data = buildSeed()
    data.projects = data.projects.filter(
      (item) => item.id !== 'example-project-learning',
    )
    data.notes.push({
      ...note('personal'),
      isExample: false,
      links: [{ type: 'projects', id: 'example-project' }],
    })
    await insert(data)
    await repository.database
      .table('meta')
      .put({ key: 'initialized', value: true })
    await repository.removeExamples()
    const current = await repository.snapshot()
    await repository.initialize()
    expect(await repository.snapshot()).toEqual(current)
  })
  it('migração não reutiliza ID de outro tipo e não deixa alterações pela metade', async () => {
    const data = buildSeed()
    data.projects = [
      { ...data.projects[0]!, title: 'Meu primeiro projeto no Atlas' },
    ]
    data.notes.push({ ...note('example-project-learning'), isExample: false })
    await insert(data)
    await repository.database
      .table('meta')
      .put({ key: 'initialized', value: true })
    await repository.initialize()
    expect(
      (await repository.snapshot()).notes.find(
        (item) => item.id === 'example-project-learning',
      ),
    ).toEqual(data.notes.at(-1))
    expect((await repository.snapshot()).projects).toHaveLength(1)
  })
})

describe('compatibilidade entre os históricos de notas e direções', () => {
  it('desfaz exclusão do projeto e depois arquivo da nota com todos os vínculos restaurados', async () => {
    const n = {
      ...note(),
      isExample: false,
      links: [{ type: 'projects' as const, id: 'project' }],
    }
    await insert({ projects: [project()], notes: [n] })
    await repository.archiveNote('note', true)
    await repository.removeDirection('projects', 'project')
    const restoredProject = await repository.undoDirectionChange()
    expect(restoredProject.notes[0]?.links).toEqual(n.links)
    expect(restoredProject.notes[0]?.archivedAt).toEqual(expect.any(String))
    const restoredNote = await repository.undoNoteChange()
    expect(restoredNote.notes).toEqual([n])
    expect(restoredNote.projects[0]?.id).toBe('project')
    expect(await repository.canUndoNoteChange()).toBe(false)
  })
  it.each(['conteúdo alterado', 'mesmo conteúdo com versão nova'])(
    'mantém proteção contra edição real posterior: %s',
    async (change) => {
      const n = {
        ...note(),
        isExample: false,
        links: [{ type: 'projects' as const, id: 'project' }],
      }
      await insert({ projects: [project()], notes: [n] })
      const archived = (await repository.archiveNote('note', true)).notes[0]!
      await repository.saveNote(
        {
          ...archived,
          content:
            change === 'conteúdo alterado'
              ? 'Texto atualizado depois do arquivo.'
              : archived.content,
        },
        archived.updatedAt,
      )
      await repository.removeDirection('projects', 'project')
      await repository.undoDirectionChange()
      const current = await repository.snapshot()
      await expect(repository.undoNoteChange()).rejects.toThrow(/mudou depois/)
      expect(await repository.snapshot()).toEqual(current)
      expect(await repository.canUndoNoteChange()).toBe(true)
    },
  )
  it('falha ao rebasear metadados reverte o undo completo e mantém ambos os históricos', async () => {
    await insert({
      projects: [project()],
      notes: [{ ...note(), links: [{ type: 'projects', id: 'project' }] }],
    })
    await repository.archiveNote('note', true)
    await repository.removeDirection('projects', 'project')
    const current = await repository.snapshot()
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('Falha ao recuperar histórico'),
    )
    await expect(repository.undoDirectionChange()).rejects.toThrow(/Falha/)
    expect(await repository.snapshot()).toEqual(current)
    expect(await repository.getDirectionUndo()).not.toBeNull()
    expect(await repository.canUndoNoteChange()).toBe(true)
    await repository.undoDirectionChange()
    expect((await repository.undoNoteChange()).notes[0]?.archivedAt).toBeNull()
  })
})
