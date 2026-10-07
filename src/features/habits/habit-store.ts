import { create } from 'zustand'
import { useData, dataError } from '../../app/data-store'
import { repository } from '../../data/service'
import { RepositoryConflictError } from '../../data/conflict-error'
import type { Habit, Snapshot } from '../../data/models'

interface HabitState {
  message: string
  error: string | null
  canUndo: boolean
  refreshUndo: () => Promise<void>
  save: (habit: Habit, expectedUpdatedAt?: string | null) => Promise<boolean>
  log: (
    habitId: string,
    date: string,
    value: number,
    rest: boolean,
    expectedUpdatedAt?: string | null,
  ) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  removeLog: (habitId: string, date: string) => Promise<boolean>
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
  useHabits.setState({ error: null, message: '' })
  try {
    await operation()
    useData.setState({ data: await repository.snapshot() })
    useHabits.setState({
      message,
      ...(undoAvailable !== undefined ? { canUndo: undoAvailable } : {}),
    })
    try {
      useHabits.setState({ canUndo: await repository.canUndoHabitRemoval() })
    } catch {
      /* The content is committed; retry undo metadata on reopening. */
    }
    return true
  } catch (error) {
    useData.setState({
      data:
        error instanceof RepositoryConflictError
          ? await repository.snapshot().catch(() => before)
          : before,
    })
    useHabits.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}

export const useHabits = create<HabitState>((set) => ({
  message: '',
  error: null,
  canUndo: false,
  refreshUndo: async () => {
    try {
      set({ canUndo: await repository.canUndoHabitRemoval() })
    } catch (error) {
      set({ error: dataError(error) })
    }
  },
  save: async (
    habit,
    expectedUpdatedAt = useData
      .getState()
      .data.habits.find((item) => item.id === habit.id)?.updatedAt ?? null,
  ) => {
    const before = useData.getState().data
    return mutate(
      () => repository.save('habits', habit, expectedUpdatedAt),
      {
        ...before,
        habits: [
          ...before.habits.filter((item) => item.id !== habit.id),
          { ...habit, isExample: false },
        ],
      },
      'Hábito salvo.',
    )
  },
  log: async (habitId, date, value, rest, expectedUpdatedAt) => {
    const before = useData.getState().data
    const previous = before.habitLogs.find(
      (item) => item.habitId === habitId && item.date === date,
    )
    const now = new Date().toISOString()
    return mutate(
      () =>
        repository.saveHabitLog(
          { habitId, date, value, rest },
          expectedUpdatedAt,
        ),
      {
        ...before,
        habitLogs: [
          ...before.habitLogs.filter((item) => item.id !== previous?.id),
          {
            id: previous?.id ?? crypto.randomUUID(),
            habitId,
            date,
            value: rest ? 0 : value,
            rest,
            createdAt: previous?.createdAt ?? now,
            updatedAt: now,
            tags: previous?.tags ?? [],
            links: previous?.links ?? [],
            isExample: false,
          },
        ],
      },
      rest ? 'Descanso registrado.' : 'Registro salvo.',
    )
  },
  remove: async (id) => {
    const before = useData.getState().data
    return mutate(
      () => repository.removeHabit(id),
      {
        ...before,
        habits: before.habits.filter((item) => item.id !== id),
        habitLogs: before.habitLogs.filter((item) => item.habitId !== id),
      },
      'Hábito e registros excluídos. Você pode desfazer.',
      true,
    )
  },
  removeLog: async (habitId, date) => {
    const before = useData.getState().data
    return mutate(
      () => repository.removeHabitLog(habitId, date),
      {
        ...before,
        habitLogs: before.habitLogs.filter(
          (item) => !(item.habitId === habitId && item.date === date),
        ),
      },
      'Registro excluído. Você pode desfazer.',
      true,
    )
  },
  undo: () =>
    mutate(
      () => repository.undoHabitRemoval(),
      undefined,
      'Exclusão desfeita. Registros existentes preservados.',
      false,
    ),
  dismiss: () => set({ message: '', error: null }),
}))
