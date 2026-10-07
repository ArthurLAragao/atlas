import { create } from 'zustand'
import type { Note, Snapshot } from '../../data/models'
import { repository } from '../../data/service'
import { dataError, useData } from '../../app/data-store'

interface NoteState {
  message: string
  error: string | null
  canUndo: boolean
  restoredId: string | null
  save: (note: Note, expected: string | null) => Promise<Note | null>
  archive: (id: string, archived: boolean) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  undo: () => Promise<boolean>
  refreshUndo: () => Promise<void>
  dismiss: () => void
}
async function change(
  operation: () => Promise<Snapshot>,
  optimistic: Snapshot | undefined,
  message: string,
) {
  if (useData.getState().busy) return false
  const before = useData.getState().data
  useData.setState({ busy: true, ...(optimistic ? { data: optimistic } : {}) })
  useNotes.setState({ error: null, message: '', restoredId: null })
  try {
    const data = await operation()
    useData.setState({ data })
    useNotes.setState({ message })
    // Confirmation never depends on this separate metadata read.
    await useNotes.getState().refreshUndo()
    return true
  } catch (error) {
    useData.setState({ data: await repository.snapshot().catch(() => before) })
    useNotes.setState({ error: dataError(error) })
    return false
  } finally {
    useData.setState({ busy: false })
  }
}
export const useNotes = create<NoteState>((set) => ({
  message: '',
  error: null,
  canUndo: false,
  restoredId: null,
  dismiss: () => set({ message: '', error: null }),
  refreshUndo: async () => {
    try {
      set({ canUndo: await repository.canUndoNoteChange() })
    } catch {
      /* Undo remains recoverable by reopening this module. */
    }
  },
  save: async (note, expected) => {
    let saved: Note | null = null
    const data = useData.getState().data
    await change(
      async () => {
        const result = await repository.saveNote(note, expected)
        saved = result.saved
        return result.data
      },
      {
        ...data,
        notes: [
          ...data.notes.filter((item) => item.id !== note.id),
          { ...note, isExample: false },
        ],
      },
      'Nota salva.',
    )
    return saved
  },
  archive: (id, archived) => {
    const data = useData.getState().data
    return change(
      () => repository.archiveNote(id, archived),
      {
        ...data,
        notes: data.notes.map((note) =>
          note.id === id
            ? {
                ...note,
                archivedAt: archived ? new Date().toISOString() : null,
              }
            : note,
        ),
      },
      archived
        ? 'Nota arquivada. Você pode desfazer.'
        : 'Nota desarquivada. Você pode desfazer.',
    )
  },
  remove: (id) => {
    const data = useData.getState().data
    return change(
      () => repository.removeNote(id),
      { ...data, notes: data.notes.filter((note) => note.id !== id) },
      'Nota excluída. Você pode desfazer.',
    )
  },
  undo: async () => {
    const before = useData.getState().data.notes
    const ok = await change(
      () => repository.undoNoteChange(),
      undefined,
      'Ação desfeita. Nota recuperada.',
    )
    if (ok) {
      const restored = useData
        .getState()
        .data.notes.find(
          (note) =>
            JSON.stringify(note) !==
            JSON.stringify(before.find((item) => item.id === note.id)),
        )
      set({ restoredId: restored?.id ?? null })
    }
    return ok
  },
}))
