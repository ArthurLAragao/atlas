import { describe, expect, it } from 'vitest'
import {
  defaultWidgets,
  moveWidget,
  normalizeWidgets,
  visibleWidgets,
  widgetIds,
} from './widgets'
import {
  defaultPreferences,
  parsePreferences,
  reduceEffect,
} from './preferences'

describe('organização e preferências', () => {
  it('mantém cinco widgets calmos e permite ocultar todos', () => {
    expect(visibleWidgets(defaultWidgets())).toHaveLength(5)
    expect(
      visibleWidgets(
        defaultWidgets().map((item) => ({ ...item, visible: false })),
      ),
    ).toEqual([])
  })
  it('normaliza valores, ignora duplicados e acrescenta widgets ausentes', () => {
    const result = normalizeWidgets([
      { id: 'focus', visible: true },
      { id: 'focus', visible: false },
      { id: 'unknown', visible: true },
      { id: 'goal', visible: 'false' },
    ])
    expect(result[0]).toEqual({ id: 'focus', visible: true })
    expect(new Set(result.map((item) => item.id)).size).toBe(widgetIds.length)
    expect(normalizeWidgets(null)).toEqual(defaultWidgets())
  })
  it('restaurar padrão recupera a ordem e visibilidade sem compartilhar estado', () => {
    const custom = moveWidget(defaultWidgets(), 'focus', 0).map((item) => ({
      ...item,
      visible: false,
    }))
    const restored = defaultWidgets()
    expect(restored.map((item) => item.id)).toEqual(widgetIds)
    expect(visibleWidgets(restored)).toEqual([
      'priorities',
      'review',
      'appointment',
      'goal',
      'habits',
    ])
    expect(custom[0]?.id).toBe('focus')
    expect(visibleWidgets(custom)).toEqual([])
    restored[0]!.visible = false
    expect(defaultWidgets()[0]?.visible).toBe(true)
  })
  it('move sem mutar e preserva visibilidade e ordem de leitura', () => {
    const original = defaultWidgets()
    const moved = moveWidget(original, 'habits', 0)
    expect(visibleWidgets(moved)[0]).toBe('habits')
    expect(original[0]?.id).toBe('priorities')
    expect(moveWidget(original, 'focus', -1)).toEqual(original)
    expect(moveWidget(original, 'focus', 1.5)).toEqual(original)
    expect(defaultWidgets()).toEqual(original)
  })
  it('migra transparência antiga e restaura opções inválidas', () => {
    expect(parsePreferences('{"solid":true}').transparency).toBe('reduce')
    expect(
      parsePreferences('{"solid":true,"transparency":"allow"}').solid,
    ).toBe(false)
    expect(
      parsePreferences('{"motion":"bad","language":"en","showXp":false}'),
    ).toMatchObject({ motion: 'system', language: 'pt-BR', showXp: false })
    expect(parsePreferences(JSON.stringify(defaultPreferences))).toEqual(
      defaultPreferences,
    )
  })
  it('respeita preferências explícitas sem confundir o sistema', () => {
    expect(reduceEffect('system', true)).toBe(true)
    expect(reduceEffect('system', false)).toBe(false)
    expect(reduceEffect('allow', true)).toBe(false)
    expect(reduceEffect('reduce', false)).toBe(true)
  })
})
