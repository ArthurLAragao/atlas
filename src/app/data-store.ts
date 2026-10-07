import { create } from 'zustand'
import { repository } from '../data/service'
import { RepositoryConflictError } from '../data/conflict-error'
import { collections, emptySnapshot, type Snapshot } from '../data/models'
import { recordCount, subtractSnapshot } from '../lib/data-records'

export function dataError(error: unknown): string {
  const name =
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    typeof error.name === 'string'
      ? error.name
      : ''
  if (/quota/i.test(name))
    return 'O armazenamento está cheio. Exporte uma cópia e libere espaço no navegador antes de tentar novamente.'
  if (
    /InvalidState|Security|UnknownError|DatabaseClosed|OpenFailed|MissingAPI/.test(
      name,
    )
  )
    return 'Não foi possível acessar seus dados. Permita o armazenamento neste navegador e tente novamente.'
  return error instanceof Error &&
    (error.name === 'Error' || error instanceof RepositoryConflictError)
    ? error.message
    : 'Não foi possível salvar. Tente novamente; seus registros anteriores foram mantidos.'
}
interface DataState {
  data: Snapshot
  status: 'loading' | 'ready' | 'error'
  error: string | null
  busy: boolean
  message: string
  canUndo: boolean
  removeExamples: () => Promise<void>
  undoExamples: () => Promise<void>
  importData: (data: Snapshot) => Promise<boolean>
}
export const useData = create<DataState>((set, get) => ({
  data: emptySnapshot(),
  status: 'loading',
  error: null,
  busy: false,
  message: '',
  canUndo: false,
  removeExamples: async () => {
    if (get().busy) return
    const before = get().data
    // The untouched seed has no personal references, so its preview is immediate.
    // Personal records require the complete Markdown graph before hiding examples.
    const onlyExamples = collections.every((name) =>
      before[name].every((item) => item.isExample),
    )
    set({ busy: true, error: null, message: '' })
    if (onlyExamples) set({ data: subtractSnapshot(before, before) })
    try {
      if (!onlyExamples) {
        const { removableExamples } = await import('../lib/data-integrity')
        set({ data: subtractSnapshot(before, removableExamples(before)) })
      }
      const removed = await repository.removeExamples()
      set({
        data: await repository.snapshot(),
        canUndo: await repository.canUndoExamples(),
        message: recordCount(removed)
          ? `${recordCount(removed)} exemplos removidos. Você pode desfazer.`
          : 'Nenhum exemplo disponível para remover.',
      })
    } catch (error) {
      set({ data: before, error: dataError(error) })
    } finally {
      set({ busy: false })
    }
  },
  undoExamples: async () => {
    if (get().busy) return
    set({ busy: true, error: null, message: '' })
    try {
      const result = await repository.undoRemoveExamples()
      set({
        data: result.data,
        canUndo: false,
        message: `${result.added} exemplos restaurados. ${result.skipped} registros existentes preservados.`,
      })
    } catch (error) {
      set({ error: dataError(error) })
    } finally {
      set({ busy: false })
    }
  },
  importData: async (data) => {
    if (get().busy) return false
    set({ busy: true, error: null, message: '' })
    try {
      const result = await repository.importData(data)
      set({
        data: result.data,
        message: `${result.added} registros importados. ${result.skipped} registros existentes preservados.`,
      })
      return true
    } catch (error) {
      set({ error: dataError(error) })
      return false
    } finally {
      set({ busy: false })
    }
  },
}))

// A subscription is scoped to the React lifetime; StrictMode cleanup cannot update a new mount.
export function connectData(): () => void {
  let active = true
  let unsubscribe: (() => void) | undefined
  useData.setState({ status: 'loading', error: null })
  void repository
    .initialize()
    .then(async () => {
      const canUndo = await repository.canUndoExamples()
      if (!active) return
      useData.setState({ canUndo })
      unsubscribe = repository.subscribe(
        (data) => {
          if (!active || useData.getState().busy) return
          useData.setState({ data, status: 'ready' })
          void repository
            .canUndoExamples()
            .then((value) => {
              if (active) useData.setState({ canUndo: value })
            })
            .catch((error: unknown) => {
              if (active) useData.setState({ error: dataError(error) })
            })
        },
        (error) => {
          if (active)
            useData.setState({ status: 'error', error: dataError(error) })
        },
      )
    })
    .catch((error: unknown) => {
      if (active) useData.setState({ status: 'error', error: dataError(error) })
    })
  return () => {
    active = false
    unsubscribe?.()
  }
}
