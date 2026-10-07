import { describe, expect, it } from 'vitest'
import type { Task } from '../data/models'
import {
  calendarDays,
  formatTaskDate,
  nextOccurrence,
  sortTasks,
} from './tasks'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Estudar AWS',
    tags: [],
    links: [],
    isExample: false,
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-10-01',
    dueTime: null,
    context: null,
    subtasks: [],
    repeat: null,
    focusMinutes: 0,
    ...overrides,
  }
}

describe('nextOccurrence', () => {
  it('does not repeat a task without repetition', () => {
    expect(nextOccurrence(task(), '2026-10-01')).toBeNull()
  })

  it.each([
    ['day', 1, '2026-10-01', '2026-10-02'],
    ['day', 3, '2026-10-01', '2026-10-04'],
    ['day', 3, '2026-10-09', '2026-10-10'],
    ['day', 3, '2026-10-10', '2026-10-13'],
    ['week', 1, '2026-10-01', '2026-10-08'],
    ['week', 2, '2026-10-30', '2026-11-12'],
    ['month', 1, '2026-10-01', '2026-11-01'],
    ['month', 2, '2027-02-15', '2027-04-01'],
  ] as const)(
    'advances %s/%i past completion %s',
    (unit, interval, completion, expected) => {
      expect(
        nextOccurrence(task({ repeat: { unit, interval } }), completion),
      ).toBe(expected)
    },
  )

  it('advances beyond the completed occurrence when finished early', () => {
    expect(
      nextOccurrence(
        task({ dueDate: '2026-10-10', repeat: { unit: 'week', interval: 1 } }),
        '2026-10-01',
      ),
    ).toBe('2026-10-17')
  })

  it('uses completion as its anchor if a repeating task has no deadline', () => {
    expect(
      nextOccurrence(
        task({ dueDate: null, repeat: { unit: 'day', interval: 2 } }),
        '2026-12-31',
      ),
    ).toBe('2027-01-02')
  })

  it.each([
    ['2026-01-31', '2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-01-31', '2028-02-29'],
    ['2026-01-31', '2026-02-28', '2026-03-31'],
    ['2026-01-31', '2026-03-30', '2026-03-31'],
    ['2026-01-31', '2026-03-31', '2026-04-30'],
  ])(
    'clamps short months without drift when skipping missed dates',
    (dueDate, completion, expected) => {
      expect(
        nextOccurrence(
          task({ dueDate, repeat: { unit: 'month', interval: 1 } }),
          completion,
        ),
      ).toBe(expected)
    },
  )

  it('skips a century of daily missed dates without iteration limits', () => {
    expect(
      nextOccurrence(
        task({ dueDate: '1900-01-01', repeat: { unit: 'day', interval: 1 } }),
        '2026-10-01',
      ),
    ).toBe('2026-10-02')
  })

  it.each(['2026-02-30', '2026-2-01', 'not-a-date'])(
    'rejects invalid completion %s',
    (date) => {
      expect(() =>
        nextOccurrence(task({ repeat: { unit: 'day', interval: 1 } }), date),
      ).toThrow(RangeError)
    },
  )

  it('rejects an invalid recurrence interval', () => {
    expect(() =>
      nextOccurrence(
        task({ repeat: { unit: 'day', interval: 0 } }),
        '2026-10-01',
      ),
    ).toThrow(RangeError)
  })

  it('rejects an impossible anchor instead of normalizing it to another month', () => {
    expect(() =>
      nextOccurrence(
        task({ dueDate: '2026-02-30', repeat: { unit: 'month', interval: 1 } }),
        '2026-10-01',
      ),
    ).toThrow(RangeError)
  })

  it.each(['day', 'week', 'month'] as const)(
    'rejects a %s occurrence outside the data format range',
    (unit) => {
      expect(() =>
        nextOccurrence(
          task({ dueDate: '9999-12-31', repeat: { unit, interval: 1 } }),
          '9999-12-31',
        ),
      ).toThrow(/limite de datas/)
    },
  )
})

describe('calendarDays', () => {
  it('creates six complete weeks with the local month and adjacent days', () => {
    const days = calendarDays(new Date(2026, 9, 19, 0, 10))
    expect(days).toHaveLength(42)
    expect(days[0]).toEqual({ date: '2026-09-28', inMonth: false })
    expect(days.at(-1)).toEqual({ date: '2026-11-08', inMonth: false })
    expect(days.filter((day) => day.inMonth)).toHaveLength(31)
    expect(new Set(days.map((day) => day.date)).size).toBe(42)
  })

  it('includes leap day and starts on Monday when the month does', () => {
    const days = calendarDays(new Date(2024, 0, 31))
    expect(days[0]?.date).toBe('2024-01-01')
    const february = calendarDays(new Date(2024, 1, 1))
    expect(february.filter((day) => day.inMonth)).toHaveLength(29)
    expect(february).toContainEqual({ date: '2024-02-29', inMonth: true })
  })

  it('handles previous-year cells without marking January as December', () => {
    const days = calendarDays(new Date(2027, 0, 1))
    expect(days[0]).toEqual({ date: '2026-12-28', inMonth: false })
    expect(days.find((day) => day.date === '2027-01-01')?.inMonth).toBe(true)
  })

  it('rejects invalid months', () => {
    expect(() => calendarDays(new Date(Number.NaN))).toThrow(RangeError)
  })
})

describe('task presentation', () => {
  it('formats a local date in Portuguese without shifting its day', () => {
    expect(formatTaskDate('2026-10-01')).toBe('1 de out de 2026')
    expect(() => formatTaskDate('2026-02-30')).toThrow(RangeError)
  })

  it('sorts pending before completed, then deadline, priority, title and ID', () => {
    const input = [
      task({
        id: 'done',
        status: 'done',
        priority: 'high',
        dueDate: '2026-09-01',
      }),
      task({ id: 'undated', dueDate: null, priority: 'high' }),
      task({ id: 'low', priority: 'low' }),
      task({ id: 'high-b', priority: 'high', title: 'B' }),
      task({ id: 'high-a2', priority: 'high', title: 'A' }),
      task({ id: 'high-a1', priority: 'high', title: 'A' }),
      task({ id: 'earlier', dueDate: '2026-09-30', priority: 'low' }),
    ]
    const original = input.map((item) => item.id)
    expect(sortTasks(input).map((item) => item.id)).toEqual([
      'earlier',
      'high-a1',
      'high-a2',
      'high-b',
      'low',
      'undated',
      'done',
    ])
    expect(input.map((item) => item.id)).toEqual(original)
  })
})
