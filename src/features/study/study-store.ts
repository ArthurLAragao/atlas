import { create } from 'zustand'
import { dataError, useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Snapshot } from '../../data/models'

type Undo = Awaited<ReturnType<typeof repository.getStudyUndo>>
interface StudyFeedback {
  error: string | null
  message: string
  undoInfo: Undo
  refreshUndo: () => Promise<void>
  dismiss: () => void
}
export const useStudy = create<StudyFeedback>((set) => ({
  error: null,
  message: '',
  undoInfo: null,
  dismiss: () => set({ error: null, message: '' }),
  refreshUndo: async () => {
    try {
      set({ undoInfo: await repository.getStudyUndo() })
    } catch {
      /* Keep confirmed writes successful. */
    }
  },
}))
export async function studyChange(
  operation: () => Promise<Snapshot>,
  message: string,
  optimistic?: Snapshot,
) {
  if (useData.getState().busy) return false
  const before = useData.getState().data
  useData.setState({ busy: true, ...(optimistic ? { data: optimistic } : {}) })
  useStudy.getState().dismiss()
  try {
    useData.setState({ data: await operation() })
    useStudy.setState({ message })
    await useStudy.getState().refreshUndo()
    return true
  } catch (error) {
    useData.setState({ data: await repository.snapshot().catch(() => before) })
    useStudy.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}
