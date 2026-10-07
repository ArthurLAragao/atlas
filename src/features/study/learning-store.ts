import { create } from 'zustand'
import { useData, dataError } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Snapshot } from '../../data/models'

export const useLearning = create<{
  error: string
  message: string
  canUndo: boolean
  canUndoFocus: boolean
}>(() => ({ error: '', message: '', canUndo: false, canUndoFocus: false }))
export async function refreshLearningUndo() {
  try {
    useLearning.setState({ canUndo: await repository.canUndoFlashcard() })
    useLearning.setState({ canUndoFocus: await repository.canUndoFocusTask() })
  } catch {
    /* A confirmed write remains confirmed. */
  }
}
export async function learningChange(
  operation: () => Promise<Snapshot>,
  message: string,
  optimistic?: Snapshot,
): Promise<boolean> {
  if (useData.getState().busy) return false
  const before = useData.getState().data
  useData.setState({ busy: true, ...(optimistic ? { data: optimistic } : {}) })
  useLearning.setState({ error: '', message: '' })
  try {
    useData.setState({ data: await operation() })
    useLearning.setState({ message })
    await refreshLearningUndo()
    return true
  } catch (error) {
    useData.setState({ data: await repository.snapshot().catch(() => before) })
    useLearning.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}
