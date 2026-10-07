import { create } from 'zustand'
import { dataError, useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Goal, Project, Snapshot, EntityMap } from '../../data/models'

type Kind = 'goals' | 'projects'
type Undo = Awaited<ReturnType<typeof repository.getDirectionUndo>>
interface DirectionState {
  error: string | null
  message: string
  undoInfo: Undo
  restored: { type: Kind; id: string } | null
  refreshUndo: () => Promise<void>
  dismiss: () => void
  saveGoal: (item: Goal, version: string | null) => Promise<Goal | null>
  saveProject: (
    item: Project,
    version: string | null,
  ) => Promise<Project | null>
  archive: (type: Kind, id: string, archived: boolean) => Promise<boolean>
  remove: (type: Kind, id: string) => Promise<boolean>
  link: (
    type: Kind,
    id: string,
    targetType: 'tasks' | 'notes' | Kind,
    targetId: string,
    linked: boolean,
  ) => Promise<boolean>
  createItem: <K extends 'tasks' | 'notes'>(
    projectId: string,
    type: K,
    item: EntityMap[K],
  ) => Promise<EntityMap[K] | null>
  undo: () => Promise<boolean>
}
async function change(
  operation: () => Promise<Snapshot>,
  message: string,
  optimistic?: Snapshot,
) {
  if (useData.getState().busy) return false
  const before = useData.getState().data
  useData.setState({ busy: true, ...(optimistic ? { data: optimistic } : {}) })
  useDirections.setState({ error: null, message: '', restored: null })
  try {
    const data = await operation()
    useData.setState({ data })
    useDirections.setState({ message })
    await useDirections.getState().refreshUndo()
    return true
  } catch (error) {
    useData.setState({ data: await repository.snapshot().catch(() => before) })
    useDirections.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}
async function save<K extends Kind>(
  type: K,
  item: EntityMap[K],
  version: string | null,
) {
  let saved: EntityMap[K] | null = null
  const before = useData.getState().data
  await change(
    async () => {
      const result = await repository.saveDirection(type, item, version)
      saved = result.saved
      return result.data
    },
    type === 'goals' ? 'Meta salva.' : 'Projeto salvo.',
    {
      ...before,
      [type]: [
        ...before[type].filter((record) => record.id !== item.id),
        { ...item, isExample: false },
      ],
    },
  )
  return saved
}
export const useDirections = create<DirectionState>((set, get) => ({
  error: null,
  message: '',
  undoInfo: null,
  restored: null,
  dismiss: () => set({ error: null, message: '', restored: null }),
  refreshUndo: async () => {
    try {
      set({ undoInfo: await repository.getDirectionUndo() })
    } catch {
      /* A confirmed write remains successful if reading history fails. */
    }
  },
  saveGoal: (item, version) => save('goals', item, version),
  saveProject: (item, version) => save('projects', item, version),
  archive: (type, id, archived) =>
    change(
      () => repository.archiveDirection(type, id, archived),
      archived
        ? 'Registro arquivado. Você pode desfazer.'
        : 'Registro desarquivado. Você pode desfazer.',
    ),
  remove: (type, id) =>
    change(
      () => repository.removeDirection(type, id),
      'Registro excluído e vínculos removidos. Você pode desfazer.',
      {
        ...useData.getState().data,
        [type]: useData.getState().data[type].filter((item) => item.id !== id),
      },
    ),
  link: (type, id, targetType, targetId, linked) =>
    change(
      () => repository.linkDirection(type, id, targetType, targetId, linked),
      linked ? 'Vínculo adicionado.' : 'Vínculo removido.',
    ),
  createItem: async (projectId, type, item) => {
    let created: typeof item | null = null
    await change(
      async () => {
        const result = await repository.createProjectItem(projectId, type, item)
        created = result.created
        return result.data
      },
      type === 'tasks'
        ? 'Tarefa criada e vinculada.'
        : 'Nota criada e vinculada.',
    )
    return created
  },
  undo: async () => {
    const info = get().undoInfo
    const ok = await change(
      () => repository.undoDirectionChange(),
      'Ação desfeita. Registro e vínculos recuperados.',
    )
    if (ok && info) set({ restored: { type: info.type, id: info.id } })
    return ok
  },
}))
