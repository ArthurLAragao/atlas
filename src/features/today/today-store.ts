import { create } from 'zustand'
import { dataError, useData } from '../../app/data-store'
import type { Goal } from '../../data/models'
import { repository } from '../../data/service'

interface TodayState {
  error: string | null
  message: string
  saveGoal: (goal: Goal) => Promise<boolean>
  dismiss: () => void
}

export const useToday = create<TodayState>((set) => ({
  error: null,
  message: '',
  saveGoal: async (goal) => {
    if (useData.getState().busy) return false
    const before = useData.getState().data
    useData.setState({
      busy: true,
      error: null,
      message: '',
      data: {
        ...before,
        goals: [
          ...before.goals
            .filter((record) => record.id !== goal.id)
            .map((record) =>
              goal.weekly ? { ...record, weekly: false } : record,
            ),
          { ...goal, isExample: false },
        ],
      },
    })
    set({ error: null, message: '' })
    try {
      if (goal.weekly !== undefined) {
        const currentGoal = before.goals.find((item) => item.id === goal.id)
        const result = await repository.saveDirection(
          'goals',
          goal,
          currentGoal ? goal.updatedAt : null,
        )
        useData.setState({ data: result.data })
        set({ message: 'Meta da semana salva.' })
        return true
      }
      const saved = await repository.save('goals', goal)
      const current = useData.getState().data
      useData.setState({
        data: {
          ...current,
          goals: [
            ...current.goals.filter((record) => record.id !== saved.id),
            saved,
          ],
        },
      })
      set({ message: 'Meta da semana salva.' })
      return true
    } catch (error) {
      useData.setState({
        data:
          goal.weekly === undefined
            ? before
            : await repository.snapshot().catch(() => before),
      })
      set({ error: dataError(error) })
      return false
    } finally {
      useData.setState({ busy: false })
    }
  },
  dismiss: () => set({ error: null, message: '' }),
}))
