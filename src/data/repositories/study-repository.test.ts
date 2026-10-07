import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { buildSeed } from '../seed'
import {
  emptySnapshot,
  type StudyPath,
  type Subject,
  type Task,
} from '../models'
import { DexieAtlasRepository } from './dexie-repository'

let repository: DexieAtlasRepository
beforeEach(() => {
  repository = new DexieAtlasRepository(
    createDatabase(`study-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  await repository.database.delete()
})
const subject = (): Subject => ({
  ...buildSeed().subjects[0]!,
  id: 'personal-subject',
  isExample: false,
})
const path = (): StudyPath => ({
  ...buildSeed().studyPaths[0]!,
  id: 'personal-path',
  isExample: false,
})
const task = (): Task => ({
  ...buildSeed().tasks[0]!,
  id: crypto.randomUUID(),
  links: [],
  isExample: false,
})

describe('repository de Estudos', () => {
  it('salva sem sobrescrever createdAt e bloqueia edições concorrentes', async () => {
    const initial = await repository.saveStudy('subjects', subject(), null)
    const edited = await repository.saveStudy(
      'subjects',
      {
        ...initial.saved,
        title: 'Disciplina editada',
        createdAt: '2020-01-01T00:00:00Z',
      },
      initial.saved.updatedAt,
    )
    expect(edited.saved.createdAt).toBe(initial.saved.createdAt)
    expect(Date.parse(edited.saved.updatedAt)).toBeGreaterThan(
      Date.parse(initial.saved.updatedAt),
    )
    await expect(
      repository.saveStudy('subjects', initial.saved, initial.saved.updatedAt),
    ).rejects.toThrow(/outra aba/)
    expect((await repository.snapshot()).subjects[0]!.title).toBe(
      'Disciplina editada',
    )
  })
  it.each(['subjects', 'studyPaths'] as const)(
    'arquiva %s e desfaz após reabrir',
    async (name) => {
      const item = name === 'subjects' ? subject() : path()
      const saved = await repository.saveStudy(name, item, null)
      await repository.archiveStudy(name, saved.saved.id, true)
      expect((await repository.get(name, item.id))!.status).toBe('archived')
      await expect(
        repository.saveStudy(name, item, saved.saved.updatedAt),
      ).rejects.toThrow()
      repository.database.close()
      await repository.database.open()
      expect((await repository.getStudyUndo())!.label).toContain('Arquivar')
      expect((await repository.undoStudyChange())[name][0]!.status).toBe(
        'active',
      )
    },
  )
  it('desarquiva preservando estado concluído e permite desfazer em cadeia', async () => {
    await repository.saveStudy(
      'subjects',
      { ...subject(), status: 'completed' },
      null,
    )
    await repository.archiveStudy('subjects', 'personal-subject', true)
    await repository.archiveStudy('subjects', 'personal-subject', false)
    expect((await repository.get('subjects', 'personal-subject'))!.status).toBe(
      'completed',
    )
    await repository.undoStudyChange()
    expect((await repository.get('subjects', 'personal-subject'))!.status).toBe(
      'archived',
    )
    await repository.undoStudyChange()
    expect((await repository.get('subjects', 'personal-subject'))!.status).toBe(
      'completed',
    )
  })
  it('exclui disciplina limpando os vínculos e restaura ambos no desfazer', async () => {
    await repository.saveStudy('subjects', subject(), null)
    const linked = {
      ...task(),
      links: [{ type: 'subjects' as const, id: 'personal-subject' }],
    }
    await repository.save('tasks', linked)
    const deleted = await repository.removeStudy('subjects', 'personal-subject')
    expect(deleted.subjects).toEqual([])
    expect(deleted.tasks[0]!.links).toEqual([])
    const restored = await repository.undoStudyChange()
    expect(restored.subjects[0]!.id).toBe('personal-subject')
    expect(restored.tasks[0]!.links).toEqual(linked.links)
  })
  it('desfazer não sobrescreve uma alteração posterior nos registros relacionados', async () => {
    await repository.saveStudy('subjects', subject(), null)
    const linked = await repository.save('tasks', {
      ...task(),
      links: [{ type: 'subjects', id: 'personal-subject' }],
    })
    await repository.removeStudy('subjects', 'personal-subject')
    const latest = (await repository.get('tasks', linked.id))!
    await repository.save('tasks', { ...latest, title: 'Alterado depois' })
    await expect(repository.undoStudyChange()).rejects.toThrow(/mudou depois/)
    expect((await repository.get('tasks', linked.id))!.title).toBe(
      'Alterado depois',
    )
  })
  it('remove avaliação com histórico persistente de desfazer', async () => {
    const initial = await repository.saveStudy(
      'subjects',
      {
        ...subject(),
        assessments: [
          {
            id: 'p1',
            title: 'P1',
            weight: null,
            score: 8,
            maxScore: 10,
            date: null,
            notes: '',
          },
        ],
      },
      null,
    )
    await repository.saveStudy(
      'subjects',
      { ...initial.saved, assessments: [] },
      initial.saved.updatedAt,
    )
    expect((await repository.getStudyUndo())!.label).toContain('Remover item')
    expect(
      (await repository.undoStudyChange()).subjects[0]!.assessments,
    ).toHaveLength(1)
  })
  it('remove a última falta com desfazer persistente sem mudar avaliações', async () => {
    const initial = await repository.saveStudy(
      'subjects',
      { ...subject(), absences: 2 },
      null,
    )
    await repository.saveStudy(
      'subjects',
      { ...initial.saved, absences: 1 },
      initial.saved.updatedAt,
    )
    expect((await repository.getStudyUndo())!.label).toContain('Remover falta')
    repository.database.close()
    await repository.database.open()
    const restored = await repository.undoStudyChange()
    expect(restored.subjects[0]!.absences).toBe(2)
    expect(restored.subjects[0]!.assessments).toEqual(initial.saved.assessments)
  })
  it('desfazer de Estudos mantém um desfazer anterior de Projeto compatível só com a versão exatamente restaurada', async () => {
    await repository.importData(buildSeed())
    const project = (await repository.list('projects'))[0]!
    const linked = await repository.save('projects', {
      ...project,
      links: [{ type: 'subjects', id: 'example-subject-0' }],
    })
    await repository.archiveDirection('projects', linked.id, true)
    await repository.removeStudy('subjects', 'example-subject-0')
    await repository.undoStudyChange()
    const restored = await repository.undoDirectionChange()
    expect(
      restored.projects.find((item) => item.id === linked.id)!.status,
    ).toBe(project.status)
    expect(
      restored.subjects.some((item) => item.id === 'example-subject-0'),
    ).toBe(true)
  })
  it('desfazer de Projeto mantém um desfazer anterior de Estudos compatível só com a versão exatamente restaurada', async () => {
    await repository.importData(buildSeed())
    const initial = (await repository.list('subjects'))[0]!
    const linked = await repository.saveStudy(
      'subjects',
      { ...initial, links: [{ type: 'projects', id: 'example-project' }] },
      initial.updatedAt,
    )
    await repository.archiveStudy('subjects', linked.saved.id, true)
    await repository.removeDirection('projects', 'example-project')
    await repository.undoDirectionChange()
    const restored = await repository.undoStudyChange()
    expect(
      restored.subjects.find((item) => item.id === initial.id)!.status,
    ).toBe('active')
    expect(
      restored.projects.some((item) => item.id === 'example-project'),
    ).toBe(true)
  })
  it('cria uma tarefa na entrega por ID, preservando vínculos de projeto e meta', async () => {
    const seed = buildSeed()
    await repository.importData(seed)
    const current = (await repository.get('subjects', seed.subjects[0]!.id))!
    const event = {
      id: 'e1',
      title: 'Lista',
      kind: 'delivery' as const,
      date: '2026-10-20',
      status: 'pending' as const,
      description: '',
      taskId: null,
    }
    await repository.saveStudy(
      'subjects',
      { ...current, events: [event] },
      current.updatedAt,
    )
    const created = await repository.createStudyTask(
      'subjects',
      current.id,
      {
        ...task(),
        links: [
          { type: 'projects', id: seed.projects[0]!.id },
          { type: 'goals', id: seed.goals[0]!.id },
        ],
      },
      event.id,
    )
    expect(created.data.tasks).toHaveLength(4)
    expect(created.created.links).toHaveLength(3)
    expect(
      created.data.subjects.find((item) => item.id === current.id)!.events[0]!
        .taskId,
    ).toBe(created.created.id)
    await expect(
      repository.createStudyTask('subjects', current.id, task(), event.id),
    ).rejects.toThrow(/já tem uma tarefa/)
  })
  it('cria tarefa da etapa sem copiar nota, e desvincula referências embutidas', async () => {
    await repository.importData(buildSeed())
    const current = (await repository.list('studyPaths'))[0]!
    const saved = await repository.saveStudy(
      'studyPaths',
      {
        ...current,
        steps: current.steps.map((step, index) =>
          index === 0 ? { ...step, noteId: 'example-note-0' } : step,
        ),
      },
      current.updatedAt,
    )
    const created = await repository.createStudyTask(
      'studyPaths',
      current.id,
      task(),
      undefined,
      saved.saved.steps[0]!.id,
    )
    expect(created.data.notes).toHaveLength(2)
    expect(
      created.data.studyPaths.find((item) => item.id === current.id)!.steps[0]!
        .taskId,
    ).toBe(created.created.id)
    await repository.linkStudy(
      'studyPaths',
      current.id,
      'tasks',
      created.created.id,
      false,
    )
    await repository.linkStudy(
      'studyPaths',
      current.id,
      'notes',
      'example-note-0',
      false,
    )
    const unlinked = (await repository.get('studyPaths', current.id))!.steps[0]!
    expect(unlinked.taskId).toBeNull()
    expect(unlinked.noteId).toBeNull()
    expect((await repository.get('tasks', created.created.id))!.links).toEqual(
      [],
    )
  })
  it('vincula tarefas e notas existentes sem duplicá-las', async () => {
    await repository.importData(buildSeed())
    const current = (await repository.list('subjects'))[0]!
    await repository.linkStudy(
      'subjects',
      current.id,
      'tasks',
      'example-task-0',
      true,
    )
    await repository.linkStudy(
      'subjects',
      current.id,
      'tasks',
      'example-task-0',
      true,
    )
    const data = await repository.linkStudy(
      'subjects',
      current.id,
      'notes',
      'example-note-0',
      true,
    )
    expect(data.tasks).toHaveLength(3)
    expect(data.notes).toHaveLength(2)
    expect(
      data.subjects.find((item) => item.id === current.id)!.links,
    ).toHaveLength(2)
  })
  it('reverte a exclusão inteira se uma escrita relacionada falhar', async () => {
    await repository.saveStudy('subjects', subject(), null)
    await repository.save('tasks', {
      ...task(),
      links: [{ type: 'subjects', id: 'personal-subject' }],
    })
    const before = await repository.snapshot()
    vi.spyOn(
      repository.database.table('tasks'),
      'bulkPut',
    ).mockRejectedValueOnce(new Error('Falha simulada'))
    await expect(
      repository.removeStudy('subjects', 'personal-subject'),
    ).rejects.toThrow('Falha simulada')
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.getStudyUndo()).toBeNull()
  })
  it('migra uma base v1 sem perder dados e acrescenta exemplos uma só vez', async () => {
    const name = `migration-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores({
      tasks: 'id, status, dueDate, context, *tags, updatedAt',
      habits: 'id, *tags, updatedAt',
      habitLogs: 'id, habitId, date, &[habitId+date], updatedAt',
      notes: 'id, title, *tags, updatedAt',
      goals: 'id, deadline, *tags, updatedAt',
      projects: 'id, *tags, updatedAt',
      meta: 'key',
    })
    const legacy = buildSeed()
    for (const collection of [
      'tasks',
      'habits',
      'habitLogs',
      'notes',
      'goals',
      'projects',
    ] as const)
      await old.table(collection).bulkPut(legacy[collection])
    await old.table('meta').put({ key: 'initialized', value: true })
    old.close()
    const migrated = new DexieAtlasRepository(createDatabase(name))
    try {
      await migrated.initialize()
      const before = await migrated.snapshot()
      expect(before.subjects).toHaveLength(2)
      expect(before.studyPaths).toHaveLength(3)
      expect(before.tasks).toEqual(legacy.tasks)
      await migrated.removeExamples()
      await migrated.initialize()
      expect(await migrated.snapshot()).toEqual(emptySnapshot())
    } finally {
      await migrated.database.delete()
    }
  })
})
