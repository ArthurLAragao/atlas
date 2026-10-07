import { useEffect } from 'react'
import {
  parsePreferences,
  preferencesKey,
  resolveTheme,
  reduceEffect,
} from '../lib/preferences'
import { usePreferences } from './preferences-store'

export function ThemeSync() {
  const preferences = usePreferences((state) => state.preferences)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const transparency = window.matchMedia(
      '(prefers-reduced-transparency: reduce)',
    )
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(
        preferences.theme,
        media.matches,
      )
      document.documentElement.dataset.accent = preferences.accent
      document.documentElement.dataset.solid = String(
        reduceEffect(preferences.transparency, transparency.matches),
      )
      document.documentElement.dataset.motion = preferences.motion
      document.documentElement.dataset.transparency = preferences.transparency
    }
    apply()
    media.addEventListener('change', apply)
    transparency.addEventListener('change', apply)
    return () => {
      media.removeEventListener('change', apply)
      transparency.removeEventListener('change', apply)
    }
  }, [preferences])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === preferencesKey || event.key === null) {
        usePreferences.setState({
          preferences: parsePreferences(event.newValue),
        })
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return null
}
