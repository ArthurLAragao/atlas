import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useClock } from '../today/use-clock'
import { useSelectedDay } from './use-selected-day'
afterEach(() => vi.useRealTimers())
it('segue meia-noite e domingo/segunda em Hoje, preservando edição de Ontem', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 59))
  const { result } = renderHook(() => useSelectedDay(useClock()))
  expect(result.current.selectedDate).toBe('2026-10-11')
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.selectedDate).toBe('2026-10-12')
  act(() => result.current.chooseYesterday())
  expect(result.current.selectedDate).toBe('2026-10-11')
  act(() => vi.setSystemTime(new Date(2026, 9, 14, 8)))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(result.current.today).toBe('2026-10-14')
  expect(result.current.selectedDate).toBe('2026-10-11')
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(result.current.selectedDate).toBe('2026-10-11')
  act(() => result.current.chooseToday())
  expect(result.current.selectedDate).toBe('2026-10-14')
  act(() => result.current.chooseDate('2026-10-09'))
  act(() => vi.setSystemTime(new Date(2026, 10, 1, 8)))
  act(() => window.dispatchEvent(new Event('pageshow')))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(result.current.selectedDate).toBe('2026-10-09')
})
