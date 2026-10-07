import { describe, expect, it } from 'vitest'
import type { Goal, Task } from '../data/models'
import {
  goalTaskProgress,
  nextAppointment,
  selectToday,
  weekEnd,
  weeklyGoal,
} from './today'

function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-10-01',
    dueTime: null,
    context: null,
    subtasks: [],
    repeat: null,
    focusMinutes: 0,
    tags: [],
    links: [],
    isExample: false,
    createdAt: '2020-01-01T00:00:00Z',
    updatedAt: '2020-01-01T00:00:00Z',
    ...changes,
  }
}
function goal(id: string, changes: Partial<Goal> = {}): Goal {
  return {
    id,
    title: id,
    deadline: null,
    keyResults: [],
    tags: [],
    links: [],
    isExample: false,
    createdAt: new Date(2026, 9, 1, 12).toISOString(),
    updatedAt: new Date(2026, 9, 1, 12).toISOString(),
    ...changes,
  }
}

describe('seleção de tarefas de hoje', () => {
  it('mantém feitas de hoje, separa compromissos e revisa apenas pendências anteriores', () => {
    const items = [
      task('today-done', { status: 'done', priority: 'high' }),
      task('future', { dueDate: '2026-10-02' }),
      task('today-low', { priority: 'low' }),
      task('old-done', { dueDate: '2026-09-30', status: 'done' }),
      task('no-deadline', { dueDate: null }),
      task('today-high', { priority: 'high' }),
      task('appointment', { tags: ['compromisso'], dueTime: '19:00' }),
      task('overdue', { dueDate: '2026-09-30', status: 'doing' }),
      task('old-appointment', {
        dueDate: '2026-09-29',
        tags: ['Compromisso'],
      }),
    ]
    const before = structuredClone(items)
    const result = selectToday(items, '2026-10-01')
    expect(result.tasks.map((item) => item.id)).toEqual([
      'today-high',
      'today-low',
      'today-done',
    ])
    expect(result.overdue.map((item) => item.id)).toEqual([
      'old-appointment',
      'overdue',
    ])
    expect(items).toEqual(before)
  })

  it('aceita coleções vazias e distingue prazo nulo de hoje', () => {
    expect(selectToday([], '2024-02-29')).toEqual({ tasks: [], overdue: [] })
    expect(
      selectToday([task('none', { dueDate: null })], '2026-10-01'),
    ).toEqual({ tasks: [], overdue: [] })
  })

  it('revisa compromissos vencidos hoje, mantém os sem hora no dia e não duplica o próximo', () => {
    const items = [
      task('past', { tags: ['Compromisso'], dueTime: '14:00' }),
      task('current', { tags: ['compromisso'], dueTime: '14:01' }),
      task('future', { tags: ['compromisso'], dueTime: '14:02' }),
      task('no-time', { tags: ['compromisso'] }),
      task('done', { tags: ['compromisso'], dueTime: '13:00', status: 'done' }),
    ]
    const before = structuredClone(items)
    const result = selectToday(items, '2026-10-01', '14:01')
    expect(result.tasks.map((item) => item.id)).toEqual(['no-time'])
    expect(result.overdue.map((item) => item.id)).toEqual(['past'])
    expect(nextAppointment(items, new Date(2026, 9, 1, 14, 1))?.id).toBe(
      'current',
    )
    expect(items).toEqual(before)
  })

  it.each(['24:00', '14:60', '14h', '1:00', ''])(
    'rejeita horário de referência inválido: %s',
    (time) => {
      expect(() => selectToday([], '2026-10-01', time)).toThrow(RangeError)
    },
  )

  it.each(['2026-02-30', '01/10/2026', '2026-1-01', '', '0000-01-01'])(
    'rejeita referência inválida: %s',
    (date) => expect(() => selectToday([], date)).toThrow(RangeError),
  )

  it('rejeita prazo inválido antes de ordenar os dados', () => {
    expect(() =>
      selectToday([task('invalid', { dueDate: '2026-02-30' })], '2026-10-01'),
    ).toThrow(RangeError)
  })
})

describe('próximo compromisso manual', () => {
  it('usa hora local e inclui horário exato, sem modificar a referência ou tarefas', () => {
    const now = new Date(2026, 9, 1, 0, 5)
    const items = [
      task('tomorrow', {
        tags: ['compromisso'],
        dueDate: '2026-10-02',
        dueTime: '00:00',
      }),
      task('past', { tags: ['compromisso'], dueTime: '00:04' }),
      task('exact', { tags: ['compromisso'], dueTime: '00:05' }),
      task('later', { tags: ['compromisso'], dueTime: '00:06' }),
    ]
    const before = structuredClone(items)
    const time = now.getTime()
    expect(nextAppointment(items, now)?.id).toBe('exact')
    expect(nextAppointment(items, new Date(2026, 9, 1, 0, 5, 59))?.id).toBe(
      'exact',
    )
    expect(nextAppointment(items, new Date(2026, 9, 1, 0, 6))?.id).toBe('later')
    expect(now.getTime()).toBe(time)
    expect(items).toEqual(before)
  })

  it('ignora tarefas comuns, feitas e compromissos sem data ou hora', () => {
    const now = new Date(2026, 9, 1, 12)
    expect(
      nextAppointment(
        [
          task('ordinary', { dueTime: '19:00' }),
          task('done', {
            tags: ['compromisso'],
            dueTime: '19:00',
            status: 'done',
          }),
          task('no-time', { tags: ['compromisso'] }),
          task('no-date', {
            tags: ['compromisso'],
            dueDate: null,
            dueTime: '19:00',
          }),
          task('past', { tags: ['compromisso'], dueTime: '11:59' }),
        ],
        now,
      ),
    ).toBeUndefined()
  })

  it('resolve empates de horário pelo ID, independente da ordem da coleção', () => {
    const a = task('a', { tags: ['compromisso'], dueTime: '19:00' })
    const b = task('b', { tags: ['compromisso'], dueTime: '19:00' })
    const now = new Date(2026, 9, 1, 12)
    expect(nextAppointment([b, a], now)).toBe(a)
    expect(nextAppointment([a, b], now)).toBe(a)
  })

  it('rejeita referência, data e hora inválidas em vez de criar um horário silencioso', () => {
    expect(() => nextAppointment([], new Date('invalid'))).toThrow(RangeError)
    expect(() =>
      nextAppointment(
        [task('bad-date', { dueDate: '2026-02-30' })],
        new Date(),
      ),
    ).toThrow(RangeError)
    expect(() =>
      nextAppointment(
        [task('bad-time', { tags: ['compromisso'], dueTime: '24:00' })],
        new Date(2026, 9, 1, 12),
      ),
    ).toThrow(RangeError)
  })
})

describe('meta da semana', () => {
  it.each([
    ['2026-09-28', '2026-10-04'],
    ['2026-10-04', '2026-10-04'],
    ['2026-12-31', '2027-01-03'],
    ['2024-02-29', '2024-03-03'],
  ])('a semana de %s termina em %s', (today, sunday) => {
    expect(weekEnd(today)).toBe(sunday)
  })

  it('prioriza a primeira meta com prazo entre segunda e domingo, inclusive', () => {
    const items = [
      goal('new-without-date'),
      goal('last-week', { deadline: '2026-09-27' }),
      goal('first-match', { deadline: '2026-10-04' }),
      goal('another-match', { deadline: '2026-09-28' }),
      goal('next-week', { deadline: '2026-10-05' }),
    ]
    const before = structuredClone(items)
    expect(weeklyGoal(items, '2026-10-01')?.id).toBe('first-match')
    expect(items).toEqual(before)
  })

  it('usa criação na semana local apenas para meta sem prazo, inclusive seed', () => {
    const items = [
      goal('old', { createdAt: new Date(2026, 8, 27, 23, 59).toISOString() }),
      goal('future-deadline', { deadline: '2026-10-05' }),
      goal('monday', { createdAt: new Date(2026, 8, 28, 0, 1).toISOString() }),
      goal('sunday', { createdAt: new Date(2026, 9, 4, 23, 59).toISOString() }),
    ]
    expect(weeklyGoal(items, '2026-10-01')?.id).toBe('monday')
    expect(weeklyGoal([items[3]!], '2026-10-01')?.id).toBe('sunday')
    expect(weeklyGoal([items[0]!], '2026-10-01')).toBeUndefined()
    expect(weeklyGoal([], '2026-10-01')).toBeUndefined()
  })

  it('rejeita datas inválidas de semana, prazo e criação do fallback', () => {
    expect(() => weekEnd('2026-02-30')).toThrow(RangeError)
    expect(() => weekEnd('9999-12-31')).toThrow(RangeError)
    expect(() =>
      weeklyGoal([goal('bad', { deadline: '2026-02-30' })], '2026-10-01'),
    ).toThrow(RangeError)
    expect(() =>
      weeklyGoal([goal('bad', { createdAt: 'invalid' })], '2026-10-01'),
    ).toThrow(RangeError)
  })
})

describe('progresso de tarefas vinculadas à meta', () => {
  it('considera vínculos dos dois lados sem contar IDs ou backlinks duas vezes', () => {
    const selected = goal('goal', {
      links: [
        { type: 'tasks', id: 'direct' },
        { type: 'tasks', id: 'both' },
        { type: 'tasks', id: 'missing' },
        { type: 'notes', id: 'not-a-task' },
      ],
    })
    const backlink = { type: 'goals' as const, id: selected.id }
    const items = [
      task('direct', { status: 'done' }),
      task('backlink', { links: [backlink] }),
      task('both', { links: [backlink] }),
      task('both', { links: [backlink] }),
      task('not-a-task', { status: 'done' }),
      task('another-goal', { links: [{ type: 'goals', id: 'other' }] }),
    ]
    const before = structuredClone({ selected, items })
    expect(goalTaskProgress(selected, items)).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    })
    expect({ selected, items }).toEqual(before)
  })

  it('retorna zero sem tarefas e cem quando todos os vínculos existentes estão feitos', () => {
    const selected = goal('goal', { links: [{ type: 'tasks', id: 'task' }] })
    expect(goalTaskProgress(selected, [])).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    })
    expect(
      goalTaskProgress(selected, [task('task', { status: 'done' })]),
    ).toEqual({ completed: 1, total: 1, percent: 100 })
  })
})
