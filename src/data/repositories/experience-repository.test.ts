import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { dateKey } from '../../lib/habits'
import { experienceSummary } from '../../lib/experience'
import { emptySnapshot } from '../models'
import { initialReview } from '../../lib/sm2'
import { encodeBackup, decodeBackup } from '../../lib/transfer'
let repository: DexieAtlasRepository
beforeEach(() => {
  repository = new DexieAtlasRepository(
    createDatabase(`xp-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.useRealTimers()
  await repository.database.delete()
})
describe('XP transacional', () => {
  it('editar uma tarefa já concluída importada não concede XP retroativo', async () => {
    await repository.initialize()
    const data = await repository.snapshot()
    const task = data.tasks[0]!
    await repository.clearAll()
    await repository.importData({
      ...data,
      tasks: data.tasks.map((item) =>
        item.id === task.id ? { ...item, status: 'done' } : item,
      ),
    })
    const imported = (await repository.snapshot()).tasks.find(
      (item) => item.id === task.id,
    )!
    await repository.save('tasks', { ...imported, title: 'Descrição revisada' })
    expect((await repository.snapshot()).experience).toEqual([])
  })
  it('falha no histórico de XP reverte a ação inteira, sem estado parcial', async () => {
    await repository.initialize()
    const before = await repository.snapshot()
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new DOMException('full', 'QuotaExceededError'),
    )
    await expect(
      repository.setTaskStatus('example-task-0', 'done'),
    ).rejects.toThrow()
    expect(await repository.snapshot()).toEqual(before)
  })
  it('tarefa não duplica ao reabrir, excluir, desfazer e recarregar', async () => {
    await repository.initialize()
    await repository.setTaskStatus('example-task-0', 'done')
    await repository.setTaskStatus('example-task-0', 'todo')
    await repository.setTaskStatus('example-task-0', 'done')
    expect(
      experienceSummary((await repository.snapshot()).experience).total,
    ).toBe(10)
    await repository.removeTask('example-task-0')
    await repository.undoTaskRemoval()
    await repository.initialize()
    expect(
      experienceSummary((await repository.snapshot()).experience).total,
    ).toBe(10)
  })
  it('hábito registra uma vez no dia, descanso/zero não pontuam e outro dia conta', async () => {
    await repository.initialize()
    const date = dateKey(new Date())
    const input = { habitId: 'example-habit-2', date, value: 0, rest: false }
    await repository.saveHabitLog(input)
    await repository.saveHabitLog({ ...input, rest: true })
    expect((await repository.snapshot()).experience).toEqual([])
    await repository.saveHabitLog({ ...input, value: 15 })
    await repository.saveHabitLog({ ...input, value: 20 })
    await repository.saveHabitLog({ ...input, value: 0 })
    await repository.saveHabitLog({ ...input, date: '2026-01-01', value: 15 })
    expect(
      experienceSummary((await repository.snapshot()).experience).total,
    ).toBe(10)
  })
  it('etapa e flashcard pontuam sem tocar metas, notas ou médias', async () => {
    await repository.initialize()
    const before = await repository.snapshot()
    const path = before.studyPaths[0]!
    const saved = await repository.saveStudy(
      'studyPaths',
      {
        ...path,
        steps: path.steps.map((step, index) => ({
          ...step,
          done: index === 0,
        })),
      },
      path.updatedAt,
    )
    await repository.saveStudy('studyPaths', saved.saved, saved.saved.updatedAt)
    const now = new Date(),
      stamp = now.toISOString()
    await repository.saveFlashcard(
      {
        id: 'card',
        question: 'Pergunta',
        answer: 'Resposta',
        status: 'active',
        review: initialReview(now),
        tags: [],
        links: [],
        createdAt: stamp,
        updatedAt: stamp,
        isExample: false,
      },
      null,
    )
    const card = (await repository.snapshot()).flashcards[0]!
    await repository.reviewFlashcard(card.id, 0, card.updatedAt)
    const after = await repository.snapshot()
    expect(experienceSummary(after.experience).total).toBe(12)
    expect(after.goals).toEqual(before.goals)
    expect(after.subjects).toEqual(before.subjects)
  })
  it('só foco concluído pontua, encerramento idempotente e backup mantém XP', async () => {
    await repository.initialize()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    let data = await repository.startFocus({
      id: 'session',
      mode: 'focus',
      plannedSeconds: 60,
      taskId: null,
    })
    const session = data.focusSessions[0]!
    vi.setSystemTime(new Date('2026-10-03T12:01:00Z'))
    data = await repository.changeFocus(
      session.id,
      'complete',
      session.updatedAt,
    )
    await repository.changeFocus(session.id, 'complete', session.updatedAt)
    expect(experienceSummary(data.experience).total).toBe(15)
    data = await repository.startFocus({
      id: 'break',
      mode: 'shortBreak',
      plannedSeconds: 60,
      taskId: null,
    })
    const pause = data.focusSessions.find((item) => item.id === 'break')!
    vi.setSystemTime(new Date('2026-10-03T12:02:00Z'))
    await repository.changeFocus(pause.id, 'complete', pause.updatedAt)
    const before = await repository.snapshot()
    const backup = encodeBackup(before)
    await repository.clearAll()
    expect(await repository.snapshot()).toEqual(emptySnapshot())
    await repository.importData(decodeBackup(backup))
    expect((await repository.snapshot()).experience).toEqual(before.experience)
    await repository.importData(decodeBackup(backup))
    expect(
      experienceSummary((await repository.snapshot()).experience).total,
    ).toBe(15)
  })
})
