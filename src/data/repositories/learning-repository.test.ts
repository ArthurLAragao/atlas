import Dexie from 'dexie'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DexieAtlasRepository } from './dexie-repository'
import { createDatabase } from '../database'
import { buildSeed } from '../seed'
import { emptySnapshot, type Flashcard } from '../models'
import { initialReview } from '../../lib/sm2'
import {
  encodeBackup,
  decodeBackup,
  encodeMarkdown,
  parseImport,
} from '../../lib/transfer'
import { remainingFocusSeconds } from '../../lib/focus'

let repository: DexieAtlasRepository
const start = new Date('2026-10-03T12:00:00Z')
const card = (): Flashcard => ({
  id: 'card',
  question: 'O que é uma pilha?',
  answer: 'Uma estrutura LIFO.',
  status: 'active',
  review: initialReview(start),
  links: [],
  tags: ['faculdade'],
  isExample: false,
  createdAt: start.toISOString(),
  updatedAt: start.toISOString(),
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  repository = new DexieAtlasRepository(
    createDatabase(`learning-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.useRealTimers()
  await repository.database.delete()
})
const active = async () =>
  (await repository.snapshot()).focusSessions.find(
    (session) => session.status === 'in-progress',
  )!
const begin = async (taskId: string | null = null) =>
  repository.startFocus({
    id: crypto.randomUUID(),
    mode: 'focus',
    plannedSeconds: 60,
    taskId,
  })
describe('repository de flashcards e sessões', () => {
  it('desvincula sessão encerrada sem perder tempo/contexto e permite excluir e restaurar tarefa', async () => {
    await repository.importData(buildSeed(start))
    await begin('example-task-0')
    const running = await active()
    await expect(
      repository.unlinkFocusTask(running.id, running.updatedAt),
    ).rejects.toThrow(/Encerre/)
    vi.setSystemTime(new Date(start.getTime() + 60000))
    const completed = await repository.changeFocus(
      running.id,
      'complete',
      running.updatedAt,
    )
    const session = completed.focusSessions[0]!
    const unlinked = await repository.unlinkFocusTask(
      session.id,
      session.updatedAt,
    )
    expect(unlinked.focusSessions[0]).toMatchObject({
      taskId: null,
      elapsedMs: 60000,
      links: session.links,
      status: 'completed',
    })
    expect(unlinked.tasks[0]!.focusMinutes).toBe(0)
    expect(await repository.canUndoFocusTask()).toBe(true)
    const restored = await repository.undoFocusTask()
    expect(restored.focusSessions[0]!.taskId).toBe('example-task-0')
    expect(restored.tasks[0]!.focusMinutes).toBe(1)
    expect(await repository.canUndoFocusTask()).toBe(false)
    await repository.unlinkFocusTask(
      session.id,
      restored.focusSessions[0]!.updatedAt,
    )
    // Clear any unrelated inbound links through the existing API/data contract.
    const data = await repository.snapshot()
    for (const project of data.projects) {
      if (
        project.links.some(
          (link) => link.type === 'tasks' && link.id === 'example-task-0',
        )
      )
        await repository.linkDirection(
          'projects',
          project.id,
          'tasks',
          'example-task-0',
          false,
        )
    }
    await repository.removeTask('example-task-0')
    expect((await repository.snapshot()).focusSessions[0]!.elapsedMs).toBe(
      60000,
    )
    await expect(repository.undoFocusTask()).rejects.toThrow(/preservado/)
    await repository.undoTaskRemoval()
    const linkedAgain = await repository.undoFocusTask()
    expect(linkedAgain.focusSessions[0]!.taskId).toBe('example-task-0')
    expect(
      linkedAgain.tasks.find((task) => task.id === 'example-task-0')!
        .focusMinutes,
    ).toBe(1)
  })
  it('desfazer vínculo não sobrescreve edição posterior da tarefa', async () => {
    await repository.importData(buildSeed(start))
    await begin('example-task-0')
    const running = await active()
    vi.setSystemTime(new Date(start.getTime() + 10000))
    const ended = await repository.changeFocus(
      running.id,
      'interrupt',
      running.updatedAt,
    )
    const unlinked = await repository.unlinkFocusTask(
      running.id,
      ended.focusSessions[0]!.updatedAt,
    )
    vi.setSystemTime(new Date(start.getTime() + 20000))
    await repository.save('tasks', {
      ...unlinked.tasks[0]!,
      title: 'Novo conteúdo',
    })
    const changed = await repository.snapshot()
    await expect(repository.undoFocusTask()).rejects.toThrow(/preservado/)
    expect(await repository.snapshot()).toEqual(changed)
  })
  it('conflitos de versão e vínculos inexistentes não escrevem parcialmente', async () => {
    await repository.importData(buildSeed(start))
    const before = await repository.snapshot()
    await expect(
      repository.startFocus({
        id: 'bad',
        mode: 'focus',
        plannedSeconds: 60,
        taskId: null,
        links: [{ type: 'subjects', id: 'missing' }],
      }),
    ).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(before)
    await begin()
    const first = await active()
    vi.setSystemTime(new Date(start.getTime() + 10000))
    await repository.changeFocus(first.id, 'pause', first.updatedAt)
    const paused = await repository.snapshot()
    await expect(
      repository.changeFocus(first.id, 'interrupt', first.updatedAt),
    ).rejects.toThrow(/outra aba/)
    expect(await repository.snapshot()).toEqual(paused)
  })
  it('falha ao somar minutos reverte também a finalização da sessão', async () => {
    await repository.importData(buildSeed(start))
    await begin('example-task-0')
    const before = await repository.snapshot()
    const current = await active()
    vi.setSystemTime(new Date(start.getTime() + 60000))
    repository.database.table('tasks').hook('updating', () => {
      throw new Error('Falha de gravação')
    })
    await expect(
      repository.changeFocus(current.id, 'complete', current.updatedAt),
    ).rejects.toThrow(/Falha de gravação/)
    expect(await repository.snapshot()).toEqual(before)
  })
  it('salva, edita sem reiniciar algoritmo, avalia uma única vez e preserva versão atual', async () => {
    let data = await repository.saveFlashcard(card(), null)
    const previous = data.flashcards[0]!
    data = await repository.reviewFlashcard(previous.id, 5, previous.updatedAt)
    expect(data.flashcards[0]!.review).toMatchObject({
      interval: 1,
      repetitions: 1,
    })
    await expect(
      repository.reviewFlashcard(previous.id, 5, previous.updatedAt),
    ).rejects.toThrow(/mudou/)
    const reviewed = data.flashcards[0]!
    data = await repository.saveFlashcard(
      {
        ...reviewed,
        answer: 'Último a entrar, primeiro a sair.',
        review: initialReview(start),
      },
      reviewed.updatedAt,
    )
    expect(data.flashcards[0]!.review).toEqual(reviewed.review)
    await expect(
      repository.saveFlashcard(previous, previous.updatedAt),
    ).rejects.toThrow(/outra aba/)
  })
  it('excluir e desfazer após reabrir mantém vínculos e agendamento', async () => {
    const data = buildSeed(start)
    await repository.importData(data)
    await repository.saveFlashcard(
      {
        ...card(),
        links: [
          { type: 'notes', id: data.notes[0]!.id },
          { type: 'subjects', id: data.subjects[0]!.id },
        ],
      },
      null,
    )
    const before = (await repository.snapshot()).flashcards[0]!
    await repository.removeFlashcard(before.id)
    repository.database.close()
    await repository.database.open()
    expect(await repository.canUndoFlashcard()).toBe(true)
    const restored = (await repository.undoFlashcard()).flashcards[0]!
    expect({ ...restored, updatedAt: before.updatedAt }).toEqual(before)
    expect(await repository.canUndoFlashcard()).toBe(false)
  })
  it('não avalia suspensos, futuros ou qualidade inválida e não grava parcialmente', async () => {
    let data = await repository.saveFlashcard(
      { ...card(), status: 'suspended' },
      null,
    )
    await expect(
      repository.reviewFlashcard('card', 4, data.flashcards[0]!.updatedAt),
    ).rejects.toThrow(/hoje/)
    data = await repository.saveFlashcard(
      { ...data.flashcards[0]!, status: 'active' },
      data.flashcards[0]!.updatedAt,
    )
    await expect(
      repository.reviewFlashcard('card', 6, data.flashcards[0]!.updatedAt),
    ).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(data)
  })
  it('bloqueia sessões concorrentes em duas instâncias do mesmo banco', async () => {
    const second = new DexieAtlasRepository(
      createDatabase(repository.database.name),
    )
    const results = await Promise.allSettled([
      begin(),
      second.startFocus({
        id: 'other',
        mode: 'focus',
        plannedSeconds: 60,
        taskId: null,
      }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect((await repository.snapshot()).focusSessions).toHaveLength(1)
    second.database.close()
  })
  it('recupera sessão após refresh e tempo em segundo plano sem concluir', async () => {
    await begin()
    vi.setSystemTime(new Date(start.getTime() + 25000))
    repository.database.close()
    await repository.database.open()
    expect(remainingFocusSeconds(await active(), Date.now())).toBe(35)
    vi.setSystemTime(new Date(start.getTime() + 1000000))
    const recovered = await active()
    expect(remainingFocusSeconds(recovered, Date.now())).toBe(0)
    expect(recovered.status).toBe('in-progress')
    expect(recovered.endedAt).toBeNull()
    expect((await repository.snapshot()).focusSessions).toHaveLength(1)
  })
  it('pausa/retoma contam tempo real uma só vez e não contam a pausa', async () => {
    await repository.importData(buildSeed(start))
    await begin('example-task-0')
    const first = await active()
    vi.setSystemTime(new Date(start.getTime() + 10500))
    await repository.changeFocus(first.id, 'pause', first.updatedAt)
    const paused = await active()
    vi.setSystemTime(new Date(start.getTime() + 90500))
    await repository.changeFocus(paused.id, 'resume', paused.updatedAt)
    vi.setSystemTime(new Date(start.getTime() + 110000))
    const resumed = await active()
    const data = await repository.changeFocus(
      resumed.id,
      'interrupt',
      resumed.updatedAt,
    )
    expect(data.focusSessions[0]!.elapsedMs).toBe(30000)
    expect(data.tasks[0]!.focusMinutes).toBe(0.5)
    expect(
      await repository.changeFocus(resumed.id, 'interrupt', resumed.updatedAt),
    ).toEqual(data)
    expect((await repository.snapshot()).goals).toEqual(
      buildSeed(start).goals.map((goal) => ({ ...goal, isExample: false })),
    )
  })
  it('completar requer tempo e soma à tarefa sem duplicar nem apagar em edição antiga', async () => {
    await repository.importData(buildSeed(start))
    const oldTask = (await repository.snapshot()).tasks[0]!
    await begin(oldTask.id)
    const running = await active()
    await expect(
      repository.changeFocus(running.id, 'complete', running.updatedAt),
    ).rejects.toThrow(/ainda/)
    vi.setSystemTime(new Date(start.getTime() + 100000))
    const complete = await repository.changeFocus(
      running.id,
      'complete',
      running.updatedAt,
    )
    expect(complete.tasks[0]!.focusMinutes).toBe(1)
    await repository.changeFocus(running.id, 'complete', running.updatedAt)
    await repository.save('tasks', {
      ...oldTask,
      title: 'Título editado em formulário anterior',
    })
    expect(
      (await repository.snapshot()).tasks.find(
        (task) => task.id === oldTask.id,
      )!.focusMinutes,
    ).toBe(1)
  })
  it('pausas curtas e longas não incrementam minutos de foco da tarefa', async () => {
    await repository.importData(buildSeed(start))
    for (const mode of ['shortBreak', 'longBreak'] as const) {
      await repository.startFocus({
        id: mode,
        mode,
        plannedSeconds: 60,
        taskId: 'example-task-0',
      })
      const current = await active()
      vi.setSystemTime(new Date(Date.now() + 60000))
      await repository.changeFocus(current.id, 'complete', current.updatedAt)
    }
    expect((await repository.snapshot()).tasks[0]!.focusMinutes).toBe(0)
  })
  it('propaga contexto embutido e mantém backup completo em JSON e Markdown', async () => {
    const seed = buildSeed(start)
    seed.studyPaths[0]!.steps[0]!.taskId = seed.tasks[0]!.id
    await repository.importData(seed)
    await repository.saveFlashcard(
      {
        ...card(),
        links: [{ type: 'studyPaths', id: seed.studyPaths[0]!.id }],
      },
      null,
    )
    await begin(seed.tasks[0]!.id)
    const data = await repository.snapshot()
    expect(data.focusSessions[0]!.links).toContainEqual({
      type: 'studyPaths',
      id: seed.studyPaths[0]!.id,
    })
    expect(decodeBackup(encodeBackup(data))).toEqual(data)
    expect(parseImport(encodeMarkdown(data), 'atlas.md')).toEqual(data)
    await repository.database.transaction(
      'rw',
      repository.database.tables,
      async () => {
        for (const table of repository.database.tables) await table.clear()
      },
    )
    expect(await repository.snapshot()).toEqual(emptySnapshot())
    expect(
      (await repository.importData(decodeBackup(encodeBackup(data)))).data,
    ).toEqual(data)
  })
  it('migra banco v2 sem perder registros existentes', async () => {
    const name = `v2-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(2).stores({
      tasks: 'id',
      notes: 'id',
      habits: 'id',
      habitLogs: 'id',
      goals: 'id',
      projects: 'id',
      subjects: 'id',
      studyPaths: 'id',
      meta: 'key',
    })
    await legacy
      .table('tasks')
      .put({ ...buildSeed(start).tasks[0]!, links: [] })
    legacy.close()
    const upgraded = new DexieAtlasRepository(createDatabase(name))
    expect((await upgraded.snapshot()).tasks).toHaveLength(1)
    expect((await upgraded.snapshot()).flashcards).toEqual([])
    expect((await upgraded.snapshot()).focusSessions).toEqual([])
    await upgraded.database.delete()
  })
})
