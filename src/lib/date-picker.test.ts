import { expect, it } from 'vitest'
import { moveCalendarDate } from './date-picker'
it.each([
  ['ArrowLeft', '2024-02-28'],
  ['ArrowRight', '2024-03-01'],
  ['ArrowUp', '2024-02-22'],
  ['ArrowDown', '2024-03-07'],
  ['Home', '2024-02-26'],
  ['End', '2024-03-03'],
  ['PageDown', '2024-03-29'],
  ['PageUp', '2024-01-29'],
])('navegação %s preserva datas locais', (key, result) =>
  expect(moveCalendarDate('2024-02-29', key)).toBe(result),
)
it('teclas de edição não são capturadas', () =>
  expect(moveCalendarDate('2024-02-29', 'a')).toBeNull())
