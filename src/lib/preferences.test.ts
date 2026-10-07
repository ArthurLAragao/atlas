import { describe, expect, it } from 'vitest'
import {
  defaultPreferences,
  parsePreferences,
  resolveTheme,
} from './preferences'

describe('preferências resilientes', () => {
  it.each([
    null,
    'invalid',
    'null',
    '42',
    '[]',
    '{"theme":"hacked","accent":"red","collapsed":"true"}',
  ])('recupera dados inválidos: %s', (raw) => {
    expect(parsePreferences(raw)).toEqual(defaultPreferences)
  })
  it('preserva preferências válidas sem aceitar propriedades desconhecidas', () => {
    expect(
      parsePreferences(
        '{"theme":"system","accent":"green","collapsed":true,"solid":true,"extra":1}',
      ),
    ).toEqual({
      ...defaultPreferences,
      transparency: 'reduce',
      theme: 'system',
      accent: 'green',
      collapsed: true,
      solid: true,
      contexts: defaultPreferences.contexts,
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
    })
  })
  it('valida e normaliza contextos sem apagar sugestões ao ler dados inválidos', () => {
    expect(
      parsePreferences('{"contexts":[" Pesquisa ","Pesquisa","Pessoal"]}')
        .contexts,
    ).toEqual(['Pesquisa', 'Pessoal'])
    expect(parsePreferences('{"contexts":[1, ""]}').contexts).toEqual(
      defaultPreferences.contexts,
    )
    expect(parsePreferences('{"contexts":[]}').contexts).toEqual([])
  })
  it('só segue o sistema quando selecionado', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
  })
  it('preserva durações válidas e recupera limites/valores inválidos', () => {
    expect(
      parsePreferences(
        '{"focusMinutes":45,"shortBreakMinutes":10,"longBreakMinutes":30}',
      ),
    ).toMatchObject({
      focusMinutes: 45,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
    })
    expect(
      parsePreferences(
        '{"focusMinutes":0,"shortBreakMinutes":61,"longBreakMinutes":1.5}',
      ),
    ).toMatchObject({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
    })
  })
})
