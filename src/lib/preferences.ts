import {
  defaultWidgets,
  normalizeWidgets,
  type WidgetPreference,
} from './widgets'
export type Theme = 'dark' | 'light' | 'system'
export type Accent = 'blue' | 'neutral' | 'green'
export type EffectPreference = 'system' | 'reduce' | 'allow'
export interface Preferences {
  theme: Theme
  accent: Accent
  collapsed: boolean
  solid: boolean
  contexts: string[]
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  motion: EffectPreference
  transparency: EffectPreference
  language: 'pt-BR'
  showXp: boolean
  widgets: WidgetPreference[]
}
export const defaultPreferences: Preferences = {
  theme: 'dark',
  accent: 'blue',
  collapsed: false,
  solid: false,
  contexts: ['Faculdade', 'Trabalho', 'Projetos', 'Pessoal', 'Academia'],
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  motion: 'system',
  transparency: 'system',
  language: 'pt-BR',
  showXp: true,
  widgets: defaultWidgets(),
}
export const preferencesKey = 'atlas.preferences.v1'

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return { ...defaultPreferences }
    const data = value as Record<string, unknown>
    const transparency = effect(
      data.transparency,
      data.solid === true ? 'reduce' : 'system',
    )
    return {
      motion: effect(data.motion),
      transparency,
      language: 'pt-BR',
      showXp: data.showXp !== false,
      widgets: normalizeWidgets(data.widgets),
      focusMinutes: duration(data.focusMinutes, 25, 180),
      shortBreakMinutes: duration(data.shortBreakMinutes, 5, 60),
      longBreakMinutes: duration(data.longBreakMinutes, 15, 120),
      theme:
        data.theme === 'light' || data.theme === 'system' ? data.theme : 'dark',
      accent:
        data.accent === 'neutral' || data.accent === 'green'
          ? data.accent
          : 'blue',
      collapsed: data.collapsed === true,
      solid: transparency === 'reduce',
      contexts:
        Array.isArray(data.contexts) &&
        data.contexts.length <= 50 &&
        data.contexts.every(
          (item: unknown) =>
            typeof item === 'string' &&
            item.trim().length > 0 &&
            item.trim().length <= 80,
        )
          ? [...new Set((data.contexts as string[]).map((item) => item.trim()))]
          : [...defaultPreferences.contexts],
    }
  } catch {
    return { ...defaultPreferences }
  }
}
function effect(
  value: unknown,
  fallback: EffectPreference = 'system',
): EffectPreference {
  return value === 'reduce' || value === 'allow' || value === 'system'
    ? value
    : fallback
}
export function reduceEffect(
  preference: EffectPreference,
  systemReduced: boolean,
): boolean {
  return preference === 'reduce' || (preference === 'system' && systemReduced)
}

export function resolveTheme(
  theme: Theme,
  systemDark: boolean,
): 'dark' | 'light' {
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}
function duration(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= max
    ? value
    : fallback
}
