import { create } from 'zustand'
import {
  defaultPreferences,
  parsePreferences,
  preferencesKey,
  type Preferences,
} from '../lib/preferences'

function readInitial(): { preferences: Preferences; storageFailed: boolean } {
  try {
    return {
      preferences: parsePreferences(localStorage.getItem(preferencesKey)),
      storageFailed: false,
    }
  } catch {
    return { preferences: { ...defaultPreferences }, storageFailed: true }
  }
}

interface PreferencesState {
  preferences: Preferences
  storageFailed: boolean
  update: (patch: Partial<Preferences>) => void
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...readInitial(),
  update: (patch) => {
    const merged = { ...get().preferences, ...patch }
    if (patch.solid !== undefined && patch.transparency === undefined)
      merged.transparency = patch.solid ? 'reduce' : 'system'
    const preferences = parsePreferences(JSON.stringify(merged))
    let storageFailed = false
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences))
    } catch {
      storageFailed = true
    }
    set({ preferences, storageFailed })
  },
}))
