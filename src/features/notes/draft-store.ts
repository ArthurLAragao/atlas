import { create } from 'zustand'
import { z } from 'zod'

const draftSchema = z.object({
  title: z.string().max(240),
  content: z.string().max(500_000),
  tags: z.string().max(4000),
  originalTags: z.array(z.string()).optional(),
  basedOn: z.string(),
})
export type NoteDraft = z.infer<typeof draftSchema>
const key = 'atlas.note-drafts.v1'
function read(): Record<string, NoteDraft> {
  try {
    return z
      .record(z.string(), draftSchema)
      .parse(JSON.parse(localStorage.getItem(key) ?? '{}'))
  } catch {
    return {}
  }
}
interface DraftState {
  clearAll: () => void
  drafts: Record<string, NoteDraft>
  error: boolean
  put: (id: string, draft: NoteDraft) => void
  clear: (id: string) => void
}
function persist(id: string, draft?: NoteDraft) {
  try {
    // Merge only this note: another tab may have saved a different draft.
    const drafts = z
      .record(z.string(), draftSchema)
      .parse(JSON.parse(localStorage.getItem(key) ?? '{}'))
    if (draft) drafts[id] = draft
    else delete drafts[id]
    localStorage.setItem(key, JSON.stringify(drafts))
    return false
  } catch {
    return true
  }
}
export const useDrafts = create<DraftState>((set, get) => ({
  clearAll: () => {
    try {
      localStorage.removeItem(key)
      set({ drafts: {}, error: false })
    } catch {
      set({ drafts: {}, error: true })
    }
  },
  drafts: read(),
  error: false,
  put: (id, draft) => {
    const drafts = { ...get().drafts, [id]: draft }
    set({ drafts, error: persist(id, draft) })
  },
  clear: (id) => {
    const drafts = { ...get().drafts }
    delete drafts[id]
    set({ drafts, error: persist(id) })
  },
}))
