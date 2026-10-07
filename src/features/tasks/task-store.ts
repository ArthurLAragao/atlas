import { create } from 'zustand'
import { useData, dataError } from '../../app/data-store'
import { repository } from '../../data/service'
import { RepositoryConflictError } from '../../data/conflict-error'
import type { Snapshot, Task } from '../../data/models'

interface TaskState {
  error: string | null
  message: string
  canUndo: boolean
  refreshUndo: () => Promise<void>
  save: (task: Task, expectedUpdatedAt?: string | null) => Promise<boolean>
  status: (task: Task, status: Task['status']) => Promise<boolean>
  postpone: (task: Task, date: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  undo: () => Promise<boolean>
  dismiss: () => void
}

async function mutate(
  operation: () => Promise<unknown>,
  optimistic: Snapshot | undefined,
  message: string,
  undoAvailable?: boolean,
) {
  if (useData.getState().busy) return false
  const before = useData.getState().data
  useData.setState({
    busy: true,
    error: null,
    message: '',
    ...(optimistic ? { data: optimistic } : {}),
  })
  useTasks.setState({ error: null, message: '' })
  try {
    await operation()
    useData.setState({ data: await repository.snapshot() })
    useTasks.setState({
      message,
      ...(undoAvailable !== undefined ? { canUndo: undoAvailable } : {}),
    })
    try {
      useTasks.setState({ canUndo: await repository.canUndoTaskRemoval() })
    } catch {
      /* A metadata read cannot reverse a confirmed content transaction. */
    }
    return true
  } catch (error) {
    useData.setState({
      data:
        error instanceof RepositoryConflictError
          ? await repository.snapshot().catch(() => before)
          : before,
    })
    useTasks.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}
function replaceTask(task: Task): Snapshot {
  const before = useData.getState().data
  return {
    ...before,
    tasks: [
      ...before.tasks.filter((item) => item.id !== task.id),
      { ...task, isExample: false },
    ],
  }
}
export const useTasks = create<TaskState>((set) => ({
  error: null,
  message: '',
  canUndo: false,
  refreshUndo: async () => {
    try {
      set({ canUndo: await repository.canUndoTaskRemoval() })
    } catch (error) {
      set({ error: dataError(error) })
    }
  },
  save: (
    task,
    expectedUpdatedAt = useData
      .getState()
      .data.tasks.find((item) => item.id === task.id)?.updatedAt ?? null,
  ) =>
    mutate(
      () => repository.save('tasks', task, expectedUpdatedAt),
      replaceTask(task),
      'Tarefa salva.',
    ),
  status: (task, status) =>
    mutate(
      () => repository.setTaskStatus(task.id, status),
      replaceTask({ ...task, status }),
      status === 'done' ? 'Tarefa concluída.' : 'Situação atualizada.',
    ),
  postpone: (task, dueDate) =>
    mutate(
      () => repository.postponeTask(task.id, dueDate),
      replaceTask({ ...task, dueDate }),
      'Tarefa adiada.',
    ),
  remove: (id) => {
    const before = useData.getState().data
    return mutate(
      () => repository.removeTask(id),
      { ...before, tasks: before.tasks.filter((task) => task.id !== id) },
      'Tarefa excluída. Você pode desfazer.',
      true,
    )
  },
  undo: () =>
    mutate(
      () => repository.undoTaskRemoval(),
      undefined,
      'Exclusão desfeita. Registros existentes preservados.',
      false,
    ),
  dismiss: () => set({ error: null, message: '' }),
}))
