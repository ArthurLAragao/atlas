import Dexie from 'dexie'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDatabase } from '../database'
import { DexieAtlasRepository } from './dexie-repository'
import { buildSeed } from '../seed'
import { collections, emptySnapshot } from '../models'
import { defaultProfile } from '../profile-models'
import { initialReview } from '../../lib/sm2'
import type { AtlasRepository } from './atlas-repository'
import { dateKey } from '../../lib/habits'
import { encodeBackup, encodeMarkdown, parseImport } from '../../lib/transfer'

let repo: DexieAtlasRepository
const start = new Date('2026-12-31T12:00:00Z')

it('registro quantitativo recusa uma edição antiga sem apagar a quantidade de outra aba', async () => {
  await repo.initialize()
  const port: AtlasRepository = repo
  const original = (await repo.snapshot()).habitLogs[0]!
  const input = {
    habitId: original.habitId,
    date: original.date,
    value: 30,
    rest: false,
  }
  await port.saveHabitLog(input, original.updatedAt)
  const latest = await repo.snapshot()
  await expect(
    port.saveHabitLog({ ...input, value: 5 }, original.updatedAt),
  ).rejects.toThrow(/outra aba/)
  expect(await repo.snapshot()).toEqual(latest)
})

it('duas intenções de fixar o mesmo item não se anulam por toggle de uma aba antiga', async () => {
  await repo.initialize()
  const port: AtlasRepository = repo
  await port.togglePinned({ type: 'projects', id: 'example-project' }, false)
  await expect(
    port.togglePinned({ type: 'projects', id: 'example-project' }, false),
  ).rejects.toThrow(/outra aba/)
  expect((await repo.snapshot()).profile?.pinned).toEqual([
    { type: 'projects', id: 'example-project' },
  ])
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(start)
  repo = new DexieAtlasRepository(
    createDatabase(`audit-9b-${crypto.randomUUID()}`),
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  await repo.database.delete()
})

it('rejeita edição obsoleta de tarefa sem reabrir a conclusão nem perder título/vínculos', async () => {
  await repo.initialize()
  const original = (await repo.snapshot()).tasks[0]!
  await repo.save(
    'tasks',
    { ...original, title: 'Versão de outra aba' },
    original.updatedAt,
  )
  await repo.setTaskStatus(original.id, 'done')
  const before = await repo.snapshot()
  await expect(
    repo.save(
      'tasks',
      { ...original, title: 'Rascunho antigo' },
      original.updatedAt,
    ),
  ).rejects.toThrow(/outra aba/)
  expect(await repo.snapshot()).toEqual(before)
})

it('duas conexões salvando a mesma versão têm um único vencedor, mesmo no mesmo milissegundo', async () => {
  await repo.initialize()
  const other = new DexieAtlasRepository(createDatabase(repo.database.name))
  try {
    const original = (await repo.snapshot()).tasks[0]!
    const result = await Promise.allSettled([
      repo.save('tasks', { ...original, title: 'Aba A' }, original.updatedAt),
      other.save('tasks', { ...original, title: 'Aba B' }, original.updatedAt),
    ])
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(result.filter((entry) => entry.status === 'rejected')).toHaveLength(
      1,
    )
    expect(
      Date.parse((await repo.get('tasks', original.id))!.updatedAt),
    ).toBeGreaterThan(Date.parse(original.updatedAt))
  } finally {
    other.database.close()
  }
})

it('protege edição obsoleta e exclusão concorrente de hábito, mantendo valores registrados', async () => {
  await repo.initialize()
  const original = (await repo.snapshot()).habits[0]!
  const updated = await repo.save(
    'habits',
    { ...original, title: 'Novo nome' },
    original.updatedAt,
  )
  const before = await repo.snapshot()
  await expect(
    repo.save('habits', original, original.updatedAt),
  ).rejects.toThrow(/outra aba/)
  expect(await repo.snapshot()).toEqual(before)
  await repo.removeHabit(updated.id)
  await expect(repo.save('habits', updated, updated.updatedAt)).rejects.toThrow(
    /outra aba/,
  )
  expect(
    (await repo.snapshot()).habits.some((habit) => habit.id === updated.id),
  ).toBe(false)
})

it('salvar perfil não apaga fixação feita em outra aba com a sheet aberta', async () => {
  await repo.initialize()
  const original = defaultProfile()
  await repo.saveProfile(original)
  await repo.togglePinned({ type: 'projects', id: 'example-project' })
  await repo.saveProfile({ ...original, name: 'Pessoa Exemplo' })
  expect((await repo.snapshot()).profile).toEqual({
    ...original,
    name: 'Pessoa Exemplo',
    pinned: [{ type: 'projects', id: 'example-project' }],
  })
})

it('rejeita edição de perfil obsoleta, preservando o texto salvo na outra aba', async () => {
  const original = defaultProfile()
  await repo.saveProfile(original)
  await repo.saveProfile({ ...original, name: 'Primeira aba' }, original)
  await expect(
    repo.saveProfile({ ...original, bio: 'Rascunho da segunda' }, original),
  ).rejects.toThrow(/outra aba/)
  expect((await repo.snapshot()).profile?.name).toBe('Primeira aba')
})

it.each(['json', 'md'] as const)(
  'ida e volta %s conserva dez coleções, perfil, avatar, fixados, XP e atividade',
  async (format) => {
    const fixture = buildSeed(start)
    for (const name of collections)
      for (const item of fixture[name]) item.isExample = false
    await repo.importData(fixture)
    await repo.saveProfile({
      ...defaultProfile(),
      name: 'Auditoria local',
      avatar: 'data:image/webp;base64,UklGRg==',
    })
    await repo.togglePinned({ type: 'projects', id: 'example-project' })
    await repo.setTaskStatus(fixture.tasks[0]!.id, 'done')
    await repo.saveHabitLog({
      habitId: fixture.habits[0]!.id,
      date: dateKey(start),
      value: 1,
      rest: false,
    })
    await repo.saveFlashcard(
      {
        id: 'audit-card',
        question: 'O que é LIFO?',
        answer: 'Último a entrar, primeiro a sair.',
        tags: ['teste'],
        links: [{ type: 'notes', id: fixture.notes[0]!.id }],
        isExample: false,
        status: 'active',
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
        review: initialReview(start),
      },
      null,
    )
    const card = (await repo.snapshot()).flashcards[0]!
    await repo.reviewFlashcard(card.id, 5, card.updatedAt)
    await repo.startFocus({
      id: 'audit-focus',
      mode: 'focus',
      plannedSeconds: 60,
      taskId: fixture.tasks[0]!.id,
    })
    const session = (await repo.snapshot()).focusSessions[0]!
    vi.setSystemTime(new Date(start.getTime() + 70_000))
    await repo.changeFocus(session.id, 'complete', session.updatedAt)
    const before = await repo.snapshot()
    expect(collections.every((name) => before[name].length > 0)).toBe(true)
    expect(before.experience.length).toBeGreaterThanOrEqual(4)
    expect(before.activity.length).toBeGreaterThanOrEqual(4)
    const backup =
      format === 'json' ? encodeBackup(before) : encodeMarkdown(before)
    await repo.clearAll()
    expect(await repo.snapshot()).toEqual(emptySnapshot())
    await repo.importData(parseImport(backup, `audit.${format}`))
    expect(await repo.snapshot()).toEqual(before)
    repo.database.close()
    await repo.database.open()
    await repo.initialize()
    expect(await repo.snapshot()).toEqual(before)
    await repo.importData(parseImport(backup, `audit.${format}`))
    expect(await repo.snapshot()).toEqual(before)
  },
)

it('migra v1 diretamente para v3 sem seed duplicado nem alteração dos registros antigos', async () => {
  const name = `audit-9b-v1-${crypto.randomUUID()}`
  const legacy = new Dexie(name)
  legacy.version(1).stores({
    tasks: 'id',
    habits: 'id',
    habitLogs: 'id, &[habitId+date]',
    notes: 'id',
    goals: 'id',
    projects: 'id',
    meta: 'key',
  })
  const task = { ...buildSeed(start).tasks[0]!, links: [], isExample: false }
  await legacy.table('tasks').put(task)
  await legacy.table('meta').put({ key: 'initialized', value: true })
  legacy.close()
  const upgraded = new DexieAtlasRepository(createDatabase(name))
  try {
    expect((await upgraded.snapshot()).tasks).toEqual([task])
    expect((await upgraded.snapshot()).flashcards).toEqual([])
    expect((await upgraded.snapshot()).focusSessions).toEqual([])
    expect(upgraded.database.verno).toBe(3)
  } finally {
    await upgraded.database.delete()
  }
})
