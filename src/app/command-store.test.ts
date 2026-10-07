import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../data/models'
import { buildSeed } from '../data/seed'
import { repository } from '../data/service'
import { useCommands } from './command-store'
import { useData } from './data-store'

beforeEach(() => {
  useData.setState({
    data: buildSeed(),
    status: 'ready',
    busy: false,
    error: null,
    message: '',
  })
  useCommands.getState().closePalette()
  useCommands.setState({
    help: false,
    query: '',
    error: '',
    message: '',
    recoveryQuery: '',
  })
})
afterEach(() => vi.restoreAllMocks())

it('expõe a nota confirmada para abrir edição, sem deixar um destino antigo após tarefa', async () => {
  vi.spyOn(repository, 'save').mockImplementation(
    async (_collection, item) => item,
  )
  useCommands.getState().openPalette('nota: Conectar ideias')
  expect(await useCommands.getState().capture()).toBe(true)
  const note = useData.getState().data.notes.at(-1)!
  expect(useCommands.getState().noteToOpen).toBe(note.id)
  useCommands.getState().openPalette('Estudar redes')
  expect(await useCommands.getState().capture()).toBe(true)
  expect(useCommands.getState().noteToOpen).toBeNull()
})

it('preserva a nota criada sem navegar quando a captura foi fechada durante a gravação', async () => {
  let confirm: () => void = () => {}
  vi.spyOn(repository, 'save').mockImplementation(
    (_collection, item) =>
      new Promise<typeof item>((resolve) => {
        confirm = () => resolve(item)
      }),
  )
  useCommands.getState().openPalette('nota: Rascunho pendente')
  const pending = useCommands.getState().capture()
  useCommands.getState().closePalette()
  confirm()
  expect(await pending).toBe(true)
  expect(useCommands.getState().noteToOpen).toBeNull()
  expect(useData.getState().data.notes.at(-1)?.title).toBe('Rascunho pendente')
})

it('mostra a captura imediatamente, bloqueia envio duplicado e preserva texto quando a quota falha', async () => {
  const before = useData.getState().data
  const query = 'Revisar cloud amanhã 19h #faculdade !alta'
  let rejectSave: (error: Error) => void = () => {}
  const save = vi
    .spyOn(repository, 'save')
    .mockImplementation((_collection, item) => {
      expect(item.isExample).toBe(false)
      return new Promise<typeof item>((_resolve, reject) => {
        rejectSave = reject
      })
    })
  const snapshot = vi.spyOn(repository, 'snapshot')
  useCommands.getState().openPalette(query)
  const pending = useCommands.getState().capture()
  expect(useData.getState().busy).toBe(true)
  expect(useData.getState().data.tasks).toHaveLength(before.tasks.length + 1)
  expect(useData.getState().data.tasks.at(-1)).toMatchObject({
    title: 'Revisar cloud',
    priority: 'high',
    dueTime: '19:00',
    tags: ['faculdade'],
    isExample: false,
  })
  expect(await useCommands.getState().capture()).toBe(false)
  expect(save).toHaveBeenCalledTimes(1)
  rejectSave(new DOMException('full', 'QuotaExceededError'))
  expect(await pending).toBe(false)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(snapshot).not.toHaveBeenCalled()
  expect(useCommands.getState()).toMatchObject({
    palette: true,
    query,
    message: '',
    recoveryQuery: query,
  })
  expect(useCommands.getState().error).toContain('armazenamento está cheio')
})

it('salva tarefa, nota e hábito nas coleções corretas e recusa uma captura inválida antes de alterar dados', async () => {
  const save = vi
    .spyOn(repository, 'save')
    .mockImplementation(async (_collection, item) => item)
  vi.spyOn(repository, 'snapshot').mockImplementation(
    async () => useData.getState().data,
  )
  const captures = [
    {
      query: 'Mapa AWS amanhã 19h #cloud !alta',
      collection: 'tasks',
      title: 'Mapa AWS',
    },
    {
      query: 'nota: Mapa de redes #faculdade',
      collection: 'notes',
      title: 'Mapa de redes',
    },
    {
      query: 'hábito: Caminhada #pessoal',
      collection: 'habits',
      title: 'Caminhada',
    },
  ] as const
  for (const capture of captures) {
    const count = useData.getState().data[capture.collection].length
    useCommands.getState().openPalette(capture.query)
    expect(await useCommands.getState().capture()).toBe(true)
    expect(useData.getState().data[capture.collection]).toHaveLength(count + 1)
    expect(save).toHaveBeenLastCalledWith(
      capture.collection,
      expect.objectContaining({ title: capture.title, isExample: false }),
    )
    expect(useCommands.getState()).toMatchObject({
      palette: false,
      query: '',
      error: '',
    })
  }
  expect(useData.getState().data.habits.at(-1)).toMatchObject({
    kind: 'binary',
    target: 1,
    timesPerWeek: 7,
  })
  expect(useData.getState().data.notes.at(-1)).toMatchObject({
    content: '',
    tags: ['faculdade'],
  })
  const before = useData.getState().data
  useCommands.getState().openPalette(`nota: ${'a'.repeat(241)}`)
  expect(await useCommands.getState().capture()).toBe(false)
  expect(save).toHaveBeenCalledTimes(3)
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useCommands.getState().error).toContain('1 a 240 caracteres')
  useCommands.getState().setQuery('amanhã 19h !alta')
  expect(await useCommands.getState().capture()).toBe(false)
  expect(save).toHaveBeenCalledTimes(3)
  expect(useData.getState().data).toEqual(before)
})

it('uma captura pendente não fecha nem apaga a caixa reaberta, mesmo com o mesmo texto', async () => {
  let resolveSave: () => void = () => {}
  vi.spyOn(repository, 'save').mockImplementation(
    (_collection, item) =>
      new Promise<typeof item>((resolve) => {
        resolveSave = () => resolve(item)
      }),
  )
  let saved: Snapshot = useData.getState().data
  vi.spyOn(repository, 'snapshot').mockImplementation(async () => saved)
  const query = 'Ler redes'
  useCommands.getState().openPalette(query)
  const pending = useCommands.getState().capture()
  saved = useData.getState().data
  useCommands.getState().closePalette()
  useCommands.getState().openPalette(query)
  resolveSave()
  expect(await pending).toBe(true)
  expect(useCommands.getState()).toMatchObject({
    palette: true,
    query,
    message: 'Tarefa criada.',
    error: '',
    recoveryQuery: '',
  })
  expect(useData.getState().data).toEqual(saved)
  expect(useData.getState().busy).toBe(false)
})

it('usa a entidade confirmada pelo repository sem reclassificar a gravação como falha de leitura', async () => {
  const before = useData.getState().data
  const savedAt = '2026-10-02T15:30:00.000Z'
  const save = vi
    .spyOn(repository, 'save')
    .mockImplementation(async (_collection, item) => ({
      ...item,
      title: 'Resumo confirmado',
      updatedAt: savedAt,
    }))
  const snapshot = vi
    .spyOn(repository, 'snapshot')
    .mockRejectedValue(new Error('leitura indisponível'))
  useCommands.getState().openPalette('nota: Resumo TCP #faculdade')
  expect(await useCommands.getState().capture()).toBe(true)
  expect(save).toHaveBeenCalledTimes(1)
  expect(snapshot).not.toHaveBeenCalled()
  expect(useData.getState().data.notes).toHaveLength(before.notes.length + 1)
  expect(useData.getState().data.notes.at(-1)).toMatchObject({
    title: 'Resumo confirmado',
    updatedAt: savedAt,
    tags: ['faculdade'],
  })
  expect(useCommands.getState()).toMatchObject({
    palette: false,
    message: 'Nota criada.',
    error: '',
    recoveryQuery: '',
  })
  expect(useData.getState().busy).toBe(false)
})

it('mantém o erro e o texto para recuperar uma captura que falha depois de fechar a caixa', async () => {
  const before = useData.getState().data
  let rejectSave: (error: Error) => void = () => {}
  vi.spyOn(repository, 'save').mockImplementation((_collection, item) => {
    expect(item).toMatchObject({ title: 'Resumo TCP' })
    return new Promise<typeof item>((_resolve, reject) => {
      rejectSave = reject
    })
  })
  const query = 'nota: Resumo TCP #faculdade'
  useCommands.getState().openPalette(query)
  const pending = useCommands.getState().capture()
  useCommands.getState().closePalette()
  rejectSave(new DOMException('full', 'QuotaExceededError'))
  expect(await pending).toBe(false)
  expect(useCommands.getState()).toMatchObject({
    palette: false,
    query: '',
    recoveryQuery: query,
    message: '',
  })
  expect(useCommands.getState().error).toContain('armazenamento está cheio')
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  useCommands.getState().openPalette(useCommands.getState().recoveryQuery)
  expect(useCommands.getState()).toMatchObject({ palette: true, query })
  useCommands.getState().dismissFeedback()
  expect(useCommands.getState()).toMatchObject({ error: '', recoveryQuery: '' })
})
