import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { emptySnapshot, type Note, type Task } from '../models'
import { DexieAtlasRepository } from './dexie-repository'

let repository: DexieAtlasRepository
beforeEach(() => {
  vi.setSystemTime(new Date(2026, 9, 1, 12))
  repository = new DexieAtlasRepository(
    createDatabase(`atlas-tasks-test-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await repository.database.delete()
})

const task = (id = 'study'): Task => ({
  id,
  title: 'Estudar AWS',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-09-01',
  dueTime: '19:00',
  context: 'Faculdade',
  subtasks: [{ id: 'chapter', title: 'Ler um capítulo', done: true }],
  repeat: { unit: 'day', interval: 1 },
  focusMinutes: 45,
  tags: ['cloud', 'faculdade'],
  links: [],
  isExample: true,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
})
const note = (): Note => ({
  id: 'study-note',
  title: 'AWS',
  content: 'Próximo capítulo.',
  tags: ['cloud'],
  links: [],
  isExample: false,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
})

describe('tarefas persistentes e repetição', () => {
  it('conclui chamadas concorrentes uma única vez e copia dados para uma ocorrência futura', async () => {
    await repository.save('notes', note())
    const original = await repository.save('tasks', {
      ...task(),
      links: [{ type: 'notes', id: 'study-note' }],
    })
    const [first, second] = await Promise.all([
      repository.setTaskStatus(original.id, 'done'),
      repository.setTaskStatus(original.id, 'done'),
    ])
    expect(second).toEqual(first)
    expect(first).toEqual({ ...original, status: 'done', updatedAt: new Date(Date.parse(original.updatedAt) + 1).toISOString() })
    const tasks = await repository.list('tasks')
    expect(tasks).toHaveLength(2)
    const successor = tasks.find((item) => item.id !== original.id)!
    expect(successor).toMatchObject({
      title: original.title,
      status: 'todo',
      priority: original.priority,
      dueDate: '2026-10-02',
      dueTime: original.dueTime,
      context: original.context,
      repeat: original.repeat,
      focusMinutes: 0,
      tags: original.tags,
      links: original.links,
      isExample: false,
    })
    expect(successor.createdAt).toBe(new Date().toISOString())
    expect(successor.updatedAt).toBe(successor.createdAt)
    expect(successor.subtasks).toHaveLength(1)
    expect(successor.subtasks[0]).toMatchObject({
      title: original.subtasks[0]!.title,
      done: false,
    })
    expect(successor.subtasks[0]!.id).not.toBe(original.subtasks[0]!.id)
  })

  it('mantém prazo e estado em atualizações concorrentes sem regravar campos obsoletos', async () => {
    const original = await repository.save('tasks', task())
    await Promise.all([
      repository.postponeTask(original.id, '2026-10-03'),
      repository.setTaskStatus(original.id, 'doing'),
    ])
    expect(await repository.get('tasks', original.id)).toEqual({
      ...original,
      status: 'doing',
      dueDate: '2026-10-03',
      updatedAt: new Date(Date.parse(original.updatedAt) + 2).toISOString(),
    })
    expect(await repository.list('tasks')).toHaveLength(1)
  })

  it('preserva ocorrência atrasada e ignora repetições perdidas, sem criar uma fila de pendências', async () => {
    await repository.save('tasks', task())
    await repository.setTaskStatus('study', 'done')
    expect((await repository.get('tasks', 'study'))?.dueDate).toBe('2026-09-01')
    expect(
      (await repository.list('tasks')).map((item) => item.dueDate).sort(),
    ).toEqual(['2026-09-01', '2026-10-02'])
  })

  it('repete tarefa sem prazo a partir do dia local da conclusão', async () => {
    await repository.save('tasks', {
      ...task(),
      dueDate: null,
      repeat: { unit: 'week', interval: 1 },
    })
    await repository.setTaskStatus('study', 'done')
    expect(
      (await repository.list('tasks')).find((item) => item.id !== 'study')
        ?.dueDate,
    ).toBe('2026-10-08')
  })

  it('não gera ocorrências para tarefa sem repetição nem muda conclusão idêntica', async () => {
    const saved = await repository.save('tasks', { ...task(), repeat: null })
    const completed = await repository.setTaskStatus(saved.id, 'done')
    vi.setSystemTime(new Date(2026, 9, 2, 12))
    expect(await repository.setTaskStatus(saved.id, 'done')).toEqual(completed)
    expect(await repository.list('tasks')).toEqual([completed])
  })

  it('reabrir e concluir após recarregar não duplica sucessor, que repete de forma independente', async () => {
    await repository.save('tasks', task())
    await repository.setTaskStatus('study', 'done')
    const successor = (await repository.list('tasks')).find(
      (item) => item.id !== 'study',
    )!
    repository.database.close()
    await repository.database.open()
    await repository.setTaskStatus('study', 'doing')
    await repository.setTaskStatus('study', 'done')
    expect(await repository.list('tasks')).toHaveLength(2)
    expect(await repository.get('tasks', successor.id)).toEqual(successor)
    await repository.setTaskStatus(successor.id, 'done')
    expect(await repository.list('tasks')).toHaveLength(3)
    expect(
      (await repository.list('tasks')).find(
        (item) => !['study', successor.id].includes(item.id),
      )?.dueDate,
    ).toBe('2026-10-03')
  })

  it('não duplica uma tarefa importada já concluída quando ela é reaberta', async () => {
    const imported = emptySnapshot()
    imported.tasks.push({ ...task(), status: 'done' })
    await repository.importData(imported)
    await repository.setTaskStatus('study', 'todo')
    await repository.setTaskStatus('study', 'done')
    expect(await repository.list('tasks')).toHaveLength(1)
  })

  it.each(['2026-02-30', '01/10/2026', '', '2026-13-01'])(
    'rejeita prazo inválido sem alterar a tarefa: %s',
    async (date) => {
      const saved = await repository.save('tasks', task())
      await expect(repository.postponeTask(saved.id, date)).rejects.toThrow(
        /data válida/,
      )
      expect(await repository.get('tasks', saved.id)).toEqual(saved)
    },
  )

  it('rejeita tarefa inexistente e estado inválido sem inserir dados', async () => {
    await expect(repository.setTaskStatus('missing', 'done')).rejects.toThrow(
      /não existe/,
    )
    await expect(
      repository.postponeTask('missing', '2026-10-02'),
    ).rejects.toThrow(/não existe/)
    await expect(
      repository.setTaskStatus('missing', 'invalid' as Task['status']),
    ).rejects.toThrow(/Escolha/)
    expect(await repository.snapshot()).toEqual(emptySnapshot())
  })

  it('reverte tarefa, sucessor e marcador se uma escrita de conclusão falhar', async () => {
    await repository.save('tasks', task())
    const before = await repository.snapshot()
    const table = repository.database.table('tasks')
    const originalPut = table.put.bind(table)
    const spy = vi
      .spyOn(table, 'put')
      .mockImplementationOnce(originalPut)
      .mockRejectedValueOnce(new Error('Falha simulada'))
    await expect(repository.setTaskStatus('study', 'done')).rejects.toThrow(
      'Falha simulada',
    )
    expect(await repository.snapshot()).toEqual(before)
    expect(
      await repository.database.table('meta').get('taskOccurrence:study'),
    ).toBeUndefined()
    spy.mockRestore()
    await repository.setTaskStatus('study', 'done')
    expect(await repository.list('tasks')).toHaveLength(2)
  })
})

describe('exclusão de tarefas com desfazer persistente', () => {
  it('restaura exatamente a tarefa após reabrir e preserva sucessor, notas e marcador de repetição', async () => {
    await repository.initialize()
    await repository.removeExamples()
    await repository.save('notes', note())
    await repository.save('tasks', {
      ...task(),
      links: [{ type: 'notes', id: 'study-note' }],
    })
    await repository.setTaskStatus('study', 'done')
    const before = await repository.snapshot()
    const removed = await repository.removeTask('study')
    expect(removed.tasks).toEqual(
      before.tasks.filter((item) => item.id === 'study'),
    )
    const remaining = await repository.snapshot()
    expect(remaining.tasks).toEqual(
      before.tasks.filter((item) => item.id !== 'study'),
    )
    expect(remaining.notes).toEqual(before.notes)
    repository.database.close()
    await repository.database.open()
    await repository.initialize()
    expect(await repository.canUndoTaskRemoval()).toBe(true)
    expect((await repository.undoTaskRemoval()).added).toBe(1)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoTaskRemoval()).toBe(false)
    expect((await repository.undoTaskRemoval()).added).toBe(0)
    await repository.setTaskStatus('study', 'todo')
    await repository.setTaskStatus('study', 'done')
    expect(await repository.list('tasks')).toHaveLength(2)
  })

  it('bloqueia exclusão de tarefa com vínculos recebidos sem perder o desfazer anterior', async () => {
    await repository.save('tasks', { ...task('earlier'), repeat: null })
    await repository.removeTask('earlier')
    await repository.save('tasks', task())
    await repository.save('notes', {
      ...note(),
      links: [{ type: 'tasks', id: 'study' }],
    })
    const before = await repository.snapshot()
    await expect(repository.removeTask('study')).rejects.toThrow(/vínculos/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoTaskRemoval()).toBe(true)
    expect((await repository.undoTaskRemoval()).added).toBe(1)
    expect(await repository.get('tasks', 'earlier')).toBeDefined()
  })

  it('desfazer nunca sobrescreve tarefa recriada e exclusão ausente preserva a última ação', async () => {
    await repository.save('tasks', task())
    await repository.removeTask('study')
    expect(await repository.removeTask('missing')).toEqual(emptySnapshot())
    const recreated = await repository.save('tasks', {
      ...task(),
      title: 'Nova tarefa no mesmo ID',
      repeat: null,
    })
    const undone = await repository.undoTaskRemoval()
    expect(undone.added).toBe(0)
    expect(undone.skipped).toBe(1)
    expect(await repository.get('tasks', 'study')).toEqual(recreated)
    expect(await repository.canUndoTaskRemoval()).toBe(false)
  })

  it('reverte exclusão inteira se não consegue salvar o desfazer', async () => {
    const saved = await repository.save('tasks', task())
    vi.spyOn(repository.database.table('meta'), 'put').mockRejectedValueOnce(
      new Error('Falha simulada'),
    )
    await expect(repository.removeTask('study')).rejects.toThrow(
      'Falha simulada',
    )
    expect(await repository.get('tasks', 'study')).toEqual(saved)
    expect(await repository.canUndoTaskRemoval()).toBe(false)
  })

  it('mantém o desfazer disponível quando a tarefa perdeu um vínculo necessário', async () => {
    await repository.save('notes', note())
    await repository.save('tasks', {
      ...task(),
      links: [{ type: 'notes', id: 'study-note' }],
    })
    await repository.removeTask('study')
    await repository.remove('notes', 'study-note')
    const before = await repository.snapshot()
    await expect(repository.undoTaskRemoval()).rejects.toThrow(/vínculos/)
    expect(await repository.snapshot()).toEqual(before)
    expect(await repository.canUndoTaskRemoval()).toBe(true)
  })
})
