import { readProfileData, recordActivity } from './profile-repository'
import { awardExperience, readExperience } from './experience-repository'
import { dateKey } from '../../lib/habits'
import type Dexie from 'dexie'
import { z } from 'zod'
import {
  collections,
  flashcardSchema,
  focusSessionSchema,
  taskSchema,
  type Flashcard,
  type FocusSession,
  type Snapshot,
} from '../models'
import { validateSnapshot } from '../../lib/data-records'
import {
  focusContext,
  focusModeLabels,
  transitionFocus,
  type FocusAction,
} from '../../lib/focus'
import { reviewCard } from '../../lib/sm2'

import type { StartFocusInput } from './atlas-repository'
const stamp = (previous?: { createdAt: string; updatedAt: string }) =>
  new Date(
    Math.max(
      Date.now(),
      previous ? Date.parse(previous.updatedAt) + 1 : 0,
      previous ? Date.parse(previous.createdAt) : 0,
    ),
  ).toISOString()
const historySchema = z.array(flashcardSchema)
const focusTaskHistorySchema = z
  .object({
    sessionBefore: focusSessionSchema,
    sessionAfter: focusSessionSchema,
    taskBefore: taskSchema,
    taskAfter: taskSchema,
  })
  .strict()

/** Same database and tables as AtlasRepository; isolated operations for the learning feature. */
export class LearningRepository {
  private readonly database: Dexie
  constructor(database: Dexie) {
    this.database = database
  }
  private async snapshot(): Promise<Snapshot> {
    const entries = await Promise.all(
      collections.map(
        async (name) =>
          [name, await this.database.table(name).toArray()] as const,
      ),
    )
    return validateSnapshot({
      ...Object.fromEntries(entries),
      experience: await readExperience(this.database),
      ...(await readProfileData(this.database)),
    })
  }
  async saveFlashcard(
    item: Flashcard,
    expectedUpdatedAt: string | null,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const previous = data.flashcards.find((card) => card.id === item.id)
      if ((previous?.updatedAt ?? null) !== expectedUpdatedAt)
        throw new Error(
          'O cartão mudou em outra aba. Reabra a versão salva antes de editar.',
        )
      const saved = flashcardSchema.parse({
        ...item,
        review: previous?.review ?? item.review,
        createdAt: previous?.createdAt ?? item.createdAt,
        updatedAt: stamp(previous ?? item),
        isExample: false,
      })
      const next = validateSnapshot({
        ...data,
        flashcards: [
          ...data.flashcards.filter((card) => card.id !== item.id),
          saved,
        ],
      })
      await this.database.table('flashcards').put(saved)
      return next
    })
  }
  async reviewFlashcard(
    id: string,
    quality: number,
    expectedUpdatedAt: string,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const card = data.flashcards.find((item) => item.id === id)
      if (!card || card.updatedAt !== expectedUpdatedAt)
        throw new Error(
          'O cartão já mudou. Atualize a fila antes de avaliar novamente.',
        )
      const today = new Date()
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (card.status !== 'active' || card.review.nextReview > date)
        throw new Error('Este cartão não está na revisão de hoje.')
      const saved: Flashcard = {
        ...card,
        review: reviewCard(card.review, quality, today),
        updatedAt: stamp(card),
        isExample: false,
      }
      const next = validateSnapshot({
        ...data,
        flashcards: data.flashcards.map((item) =>
          item.id === id ? saved : item,
        ),
      })
      await this.database.table('flashcards').put(saved)
      next.activity = await recordActivity(
        this.database,
        'flashcard',
        id,
        card.question,
        date,
      )
      next.experience = await awardExperience(
        this.database,
        'flashcard',
        id,
        date,
      )
      return next
    })
  }
  async removeFlashcard(id: string): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const card = data.flashcards.find((item) => item.id === id)
      if (!card) throw new Error('Cartão não encontrado. Atualize a fila.')
      const history = historySchema.parse(
        (await this.database.table('meta').get('flashcardHistory'))?.value ??
          [],
      )
      await this.database.table('flashcards').delete(id)
      await this.database
        .table('meta')
        .put({ key: 'flashcardHistory', value: [...history, card] })
      return {
        ...data,
        flashcards: data.flashcards.filter((item) => item.id !== id),
      }
    })
  }
  async canUndoFlashcard(): Promise<boolean> {
    return (
      historySchema.parse(
        (await this.database.table('meta').get('flashcardHistory'))?.value ??
          [],
      ).length > 0
    )
  }
  async undoFlashcard(): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const history = historySchema.parse(
        (await this.database.table('meta').get('flashcardHistory'))?.value ??
          [],
      )
      const previous = history.at(-1)
      if (!previous) return data
      if (
        collections.some((name) =>
          data[name].some((item) => item.id === previous.id),
        )
      )
        throw new Error(
          'Este ID já está em uso. O conteúdo atual foi preservado.',
        )
      const saved = { ...previous, updatedAt: stamp(previous) }
      const next = validateSnapshot({
        ...data,
        flashcards: [...data.flashcards, saved],
      })
      await this.database.table('flashcards').put(saved)
      await this.database
        .table('meta')
        .put({ key: 'flashcardHistory', value: history.slice(0, -1) })
      return next
    })
  }
  async startFocus(input: StartFocusInput): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      if (
        data.focusSessions.some((session) => session.status === 'in-progress')
      )
        throw new Error(
          'Já existe uma sessão em andamento. Retome ou encerre essa sessão primeiro.',
        )
      const task = input.taskId
        ? data.tasks.find((item) => item.id === input.taskId)
        : undefined
      const timestamp = stamp()
      const links = [
        ...focusContext(data, input.taskId),
        ...(input.links ?? []),
      ]
      if (
        links.some(
          (link) => !['projects', 'subjects', 'studyPaths'].includes(link.type),
        )
      )
        throw new Error(
          'Escolha um projeto, disciplina ou trilha para o contexto de foco.',
        )
      const session: FocusSession = {
        id: input.id,
        title: task?.title ?? focusModeLabels[input.mode],
        tags: [],
        isExample: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        mode: input.mode,
        plannedSeconds: input.plannedSeconds,
        taskId: input.taskId,
        links: [
          ...new Map(
            links.map((link) => [`${link.type}:${link.id}`, link]),
          ).values(),
        ],
        status: 'in-progress',
        timerState: 'running',
        elapsedMs: 0,
        segmentStartedAt: timestamp,
        startedAt: timestamp,
        endedAt: null,
      }
      const next = validateSnapshot({
        ...data,
        focusSessions: [...data.focusSessions, session],
      })
      await this.database.table('focusSessions').put(session)
      return next
    })
  }
  async unlinkFocusTask(
    id: string,
    expectedUpdatedAt: string,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const sessionBefore = data.focusSessions.find(
        (session) => session.id === id,
      )
      if (!sessionBefore || sessionBefore.updatedAt !== expectedUpdatedAt)
        throw new Error(
          'A sessão mudou. Atualize a página antes de desvincular.',
        )
      if (sessionBefore.status === 'in-progress')
        throw new Error('Encerre a sessão antes de desvincular a tarefa.')
      const taskBefore = data.tasks.find(
        (task) => task.id === sessionBefore.taskId,
      )
      if (!taskBefore)
        throw new Error('Esta sessão já está sem tarefa vinculada.')
      const sessionAfter = {
        ...sessionBefore,
        taskId: null,
        updatedAt: stamp(sessionBefore),
      }
      const taskAfter = {
        ...taskBefore,
        focusMinutes: Math.max(
          0,
          taskBefore.focusMinutes -
            (sessionBefore.mode === 'focus'
              ? sessionBefore.elapsedMs / 60000
              : 0),
        ),
        updatedAt: stamp(taskBefore),
      }
      const next = validateSnapshot({
        ...data,
        focusSessions: data.focusSessions.map((session) =>
          session.id === id ? sessionAfter : session,
        ),
        tasks: data.tasks.map((task) =>
          task.id === taskBefore.id ? taskAfter : task,
        ),
      })
      await this.database.table('focusSessions').put(sessionAfter)
      await this.database.table('tasks').put(taskAfter)
      await this.database.table('meta').put({
        key: 'focusTaskHistory',
        value: { sessionBefore, sessionAfter, taskBefore, taskAfter },
      })
      return next
    })
  }
  async canUndoFocusTask(): Promise<boolean> {
    return Boolean(await this.database.table('meta').get('focusTaskHistory'))
  }
  async undoFocusTask(): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const record = await this.database.table('meta').get('focusTaskHistory')
      if (!record) return data
      const history = focusTaskHistorySchema.parse(record.value)
      const currentSession = data.focusSessions.find(
        (session) => session.id === history.sessionAfter.id,
      )
      const currentTask = data.tasks.find(
        (task) => task.id === history.taskAfter.id,
      )
      if (
        currentSession?.updatedAt !== history.sessionAfter.updatedAt ||
        currentTask?.updatedAt !== history.taskAfter.updatedAt
      )
        throw new Error(
          'A tarefa ou sessão mudou após desvincular. O conteúdo atual foi preservado; vincule uma nova sessão quando necessário.',
        )
      const session = {
        ...history.sessionBefore,
        updatedAt: stamp(currentSession),
      }
      const task = { ...history.taskBefore, updatedAt: stamp(currentTask) }
      const next = validateSnapshot({
        ...data,
        focusSessions: data.focusSessions.map((item) =>
          item.id === session.id ? session : item,
        ),
        tasks: data.tasks.map((item) => (item.id === task.id ? task : item)),
      })
      await this.database.table('focusSessions').put(session)
      await this.database.table('tasks').put(task)
      await this.database.table('meta').delete('focusTaskHistory')
      return next
    })
  }
  async changeFocus(
    id: string,
    action: FocusAction,
    expectedUpdatedAt: string,
  ): Promise<Snapshot> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const data = await this.snapshot()
      const previous = data.focusSessions.find((item) => item.id === id)
      if (!previous)
        throw new Error('Sessão não encontrada. Atualize a página.')
      // Retried terminal transitions are idempotent, even with an old version token.
      if (
        (previous.status === 'completed' && action === 'complete') ||
        (previous.status === 'interrupted' && action === 'interrupt')
      )
        return data
      if (previous.updatedAt !== expectedUpdatedAt)
        throw new Error(
          'A sessão mudou em outra aba. O estado mais recente foi recuperado; tente novamente.',
        )
      const result = transitionFocus(previous, action, Date.now())
      if (result === previous) return data
      const saved = { ...result, updatedAt: stamp(previous) }
      const finalized = saved.status !== 'in-progress'
      const tasks =
        finalized && saved.mode === 'focus' && saved.taskId
          ? data.tasks.map((task) =>
              task.id === saved.taskId
                ? {
                    ...task,
                    focusMinutes: task.focusMinutes + saved.elapsedMs / 60_000,
                    updatedAt: stamp(task),
                    isExample: false,
                  }
                : task,
            )
          : data.tasks
      const next = validateSnapshot({
        ...data,
        tasks,
        focusSessions: data.focusSessions.map((item) =>
          item.id === id ? saved : item,
        ),
      })
      await this.database.table('focusSessions').put(saved)
      if (finalized && saved.mode === 'focus' && saved.elapsedMs > 0)
        next.activity = await recordActivity(
          this.database,
          'focus',
          id,
          saved.title,
          dateKey(new Date()),
          saved.elapsedMs / 60000,
        )
      if (saved.status === 'completed' && saved.mode === 'focus')
        next.experience = await awardExperience(
          this.database,
          'focus',
          id,
          dateKey(new Date()),
        )
      if (tasks !== data.tasks) {
        const task = tasks.find((item) => item.id === saved.taskId)
        if (task) await this.database.table('tasks').put(task)
      }
      return next
    })
  }
}
