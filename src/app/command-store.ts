import { useEffect } from 'react'
import { create } from 'zustand'
import { repository } from '../data/service'
import type { Snapshot } from '../data/models'
import {
  createCapturedEntity,
  parseCapture,
  type CapturedEntity,
} from '../lib/capture'
import { dataError, useData } from './data-store'

interface CommandState {
  palette: boolean
  help: boolean
  query: string
  message: string
  error: string
  recoveryQuery: string
  noteToOpen: string | null
  openPalette: (query?: string) => void
  closePalette: () => void
  openHelp: () => void
  closeHelp: () => void
  setQuery: (query: string) => void
  dismissFeedback: () => void
  capture: () => Promise<boolean>
}

let previousFocus: HTMLElement | null = null
let paletteIntent = 0

function hasOtherDialog(): boolean {
  return (
    typeof document !== 'undefined' &&
    Array.from(
      document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
    ).some(
      (dialog) =>
        !dialog.hasAttribute('data-command-dialog') &&
        !dialog.querySelector('[data-shortcut-help]'),
    )
  )
}

function rememberFocus() {
  if (typeof document !== 'undefined')
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
}

export function restoreCommandFocus() {
  if (typeof document === 'undefined') return
  if (previousFocus?.isConnected) previousFocus.focus()
  else
    document.querySelector<HTMLButtonElement>('[data-command-trigger]')?.focus()
}

function upsertCapture(data: Snapshot, entry: CapturedEntity): Snapshot {
  switch (entry.collection) {
    case 'tasks':
      return {
        ...data,
        tasks: [
          ...data.tasks.filter((item) => item.id !== entry.item.id),
          entry.item,
        ],
      }
    case 'notes':
      return {
        ...data,
        notes: [
          ...data.notes.filter((item) => item.id !== entry.item.id),
          entry.item,
        ],
      }
    case 'habits':
      return {
        ...data,
        habits: [
          ...data.habits.filter((item) => item.id !== entry.item.id),
          entry.item,
        ],
      }
  }
}

async function saveCapture(entry: CapturedEntity): Promise<CapturedEntity> {
  switch (entry.collection) {
    case 'tasks':
      return {
        collection: 'tasks',
        item: await repository.save('tasks', entry.item),
      }
    case 'notes':
      return {
        collection: 'notes',
        item: await repository.save('notes', entry.item),
      }
    case 'habits':
      return {
        collection: 'habits',
        item: await repository.save('habits', entry.item),
      }
  }
}

export const useCommands = create<CommandState>((set, get) => ({
  palette: false,
  help: false,
  query: '',
  message: '',
  error: '',
  recoveryQuery: '',
  noteToOpen: null,
  openPalette: (query = '') => {
    if (hasOtherDialog()) return
    paletteIntent += 1
    const current = get()
    if (!current.palette && !current.help) rememberFocus()
    if (current.help) {
      set({ help: false })
      requestAnimationFrame(() => {
        if (!get().help && !get().palette)
          set({ palette: true, query, error: '' })
      })
    } else set({ palette: true, help: false, query, error: '' })
  },
  closePalette: () => {
    paletteIntent += 1
    set({ palette: false, query: '', error: '' })
  },
  openHelp: () => {
    if (hasOtherDialog()) return
    const current = get()
    if (!current.palette && !current.help) rememberFocus()
    if (current.palette) {
      paletteIntent += 1
      set({ palette: false, query: '', error: '' })
      requestAnimationFrame(() => {
        if (!get().help && !get().palette) set({ help: true })
      })
    } else set({ help: true, palette: false })
  },
  closeHelp: () => set({ help: false }),
  setQuery: (query) => set({ query, error: '' }),
  dismissFeedback: () => set({ message: '', error: '', recoveryQuery: '' }),
  capture: async () => {
    if (useData.getState().busy) return false
    if (useData.getState().status !== 'ready') {
      set({ error: 'Aguarde seus dados carregarem e tente novamente.' })
      return false
    }
    const query = get().query
    const intent = paletteIntent
    let entry: CapturedEntity
    try {
      const now = new Date()
      entry = createCapturedEntity(
        parseCapture(query, now),
        now,
        crypto.randomUUID(),
      )
    } catch {
      set({
        error:
          'Use um nome de 1 a 240 caracteres e até 50 tags de 60 caracteres. Em notas, evite [[ e ]].',
      })
      return false
    }
    const before = useData.getState().data
    useData.setState({
      busy: true,
      error: null,
      message: '',
      data: upsertCapture(before, entry),
    })
    set({ error: '', message: '', noteToOpen: null })
    try {
      const saved = await saveCapture(entry)
      useData.setState({ data: upsertCapture(useData.getState().data, saved) })
      set({
        message:
          entry.collection === 'tasks'
            ? 'Tarefa criada.'
            : entry.collection === 'notes'
              ? 'Nota criada.'
              : 'Hábito criado.',
        error: '',
        recoveryQuery: '',
        noteToOpen:
          saved.collection === 'notes' && paletteIntent === intent
            ? saved.item.id
            : null,
        ...(paletteIntent === intent ? { palette: false, query: '' } : {}),
      })
      return true
    } catch (error) {
      useData.setState({ data: before })
      set({ error: dataError(error), recoveryQuery: query })
      return false
    } finally {
      useData.setState({ busy: false })
    }
  },
}))

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    Boolean(target.closest('input, textarea, select, [role="textbox"]')) ||
    target.isContentEditable
  )
}

export function useCommandShortcuts() {
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.repeat ||
        event.getModifierState('AltGraph') ||
        hasOtherDialog()
      )
        return
      const command = useCommands.getState()
      if (
        event.key.toLocaleLowerCase('pt-BR') === 'k' &&
        event.ctrlKey !== event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        if (command.palette) command.closePalette()
        else command.openPalette()
      } else if (
        event.key === '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !editable(event.target)
      ) {
        event.preventDefault()
        if (command.help) command.closeHelp()
        else command.openHelp()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [])
}
