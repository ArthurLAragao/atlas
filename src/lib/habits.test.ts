import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../data/models'
import {
  aggregateDay,
  dateKey,
  formatDay,
  generateHeatmap,
  getStreaks,
  habitDay,
  intensity,
  weekProgress,
} from './habits'

const base = {
  tags: [],
  links: [],
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
  isExample: false,
}
const daily: Habit = {
  ...base,
  id: 'habit-daily',
  title: 'Ler',
  kind: 'binary',
  target: 1,
  unit: 'vez',
  timesPerWeek: 7,
}
const water: Habit = {
  ...daily,
  id: 'water',
  title: 'Água',
  kind: 'quantity',
  target: 3,
  unit: 'L',
}
const weekly: Habit = {
  ...daily,
  id: 'weekly',
  title: 'Academia',
  timesPerWeek: 3,
}
function log(date: string, value = 1, rest = false, habit = daily): HabitLog {
  return {
    ...base,
    id: `${habit.id}-${date}`,
    habitId: habit.id,
    date,
    value,
    rest,
  }
}

describe('calendário do heatmap', () => {
  it('mantém a data local, inclusive perto da meia-noite', () => {
    expect(dateKey(new Date(2024, 1, 29, 23, 59))).toBe('2024-02-29')
    expect(dateKey(new Date(2025, 0, 1, 0, 1))).toBe('2025-01-01')
    expect(() => dateKey(new Date('invalid'))).toThrow('data válida')
  })
  it('oferece uma data extensa e inequívoca em português', () => {
    expect(formatDay('2024-02-29')).toBe(
      'quinta-feira, 29 de fevereiro de 2024',
    )
    expect(() => formatDay('2023-02-29')).toThrow('data válida')
    expect(() => formatDay('2024-02-29T12:00:00Z')).toThrow('data válida')
  })
  it('gera colunas de segunda a domingo e identifica os dias futuros', () => {
    expect(generateHeatmap('2024-02-29', 1)).toEqual([
      [
        { date: '2024-02-26', future: false },
        { date: '2024-02-27', future: false },
        { date: '2024-02-28', future: false },
        { date: '2024-02-29', future: false },
        { date: '2024-03-01', future: true },
        { date: '2024-03-02', future: true },
        { date: '2024-03-03', future: true },
      ],
    ])
  })
  it('atravessa anos com datas únicas e aceita até 53 semanas', () => {
    const grid = generateHeatmap('2025-01-01', 53)
    expect(grid).toHaveLength(53)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    const cells = grid.flat()
    expect(cells).toHaveLength(371)
    expect(new Set(cells.map((cell) => cell.date)).size).toBe(371)
    expect(grid[52]?.[0]?.date).toBe('2024-12-30')
    expect(cells.at(-1)?.date).toBe('2025-01-05')
    expect(cells.filter((cell) => cell.date === '2024-02-29')).toHaveLength(1)
  })
  it.each([0, -1, 54, 1.5, NaN, Infinity])(
    'rejeita o período inválido %s',
    (weeks) => {
      expect(() => generateHeatmap('2024-03-01', weeks)).toThrow(
        '1 a 53 semanas',
      )
    },
  )
  it('não normaliza silenciosamente datas inexistentes', () => {
    expect(() => generateHeatmap('2024-04-31', 13)).toThrow('data válida')
  })
})

describe('registro e intensidade', () => {
  it('preserva quantidade parcial e só conclui ao atingir a meta', () => {
    const logs = [log('2024-02-29', 1.5, false, water)]
    expect(habitDay(water, logs, '2024-02-29')).toEqual({
      value: 1.5,
      ratio: 0.5,
      rest: false,
      completed: false,
    })
    expect(
      habitDay(water, [log('2024-02-29', 4, false, water)], '2024-02-29')
        .completed,
    ).toBe(true)
    expect(habitDay(daily, logs, '2024-02-29')).toEqual({
      value: 0,
      ratio: 0,
      rest: false,
      completed: false,
    })
  })
  it('descanso não é conclusão, mesmo quando o registro tem valor', () => {
    expect(habitDay(daily, [log('2024-02-29', 1, true)], '2024-02-29')).toEqual(
      { value: 1, ratio: 0, rest: true, completed: false },
    )
  })
  it.each([
    [-1, 0],
    [0, 0],
    [NaN, 0],
    [Infinity, 0],
    [0.001, 1],
    [0.25, 1],
    [0.251, 2],
    [0.5, 2],
    [0.501, 3],
    [0.75, 3],
    [0.751, 3],
    [0.76, 3],
    [0.99, 3],
    [1, 4],
    [3, 4],
  ])('mapeia proporção %s para o nível %s', (ratio, expected) => {
    expect(intensity(ratio)).toBe(expected)
  })
  it('normaliza metas distintas, limita excedentes e exclui descanso da média', () => {
    const logs = [log('2024-02-29'), log('2024-02-29', 1.5, false, water)]
    expect(aggregateDay([daily, water], logs, '2024-02-29')).toEqual({
      ratio: 0.75,
      completed: 1,
      total: 2,
      rest: 0,
    })
    expect(
      aggregateDay(
        [daily, water],
        [log('2024-02-29', 0, true), log('2024-02-29', 6, false, water)],
        '2024-02-29',
      ),
    ).toEqual({ ratio: 1, completed: 1, total: 2, rest: 1 })
    expect(aggregateDay([], [], '2024-02-29')).toEqual({
      ratio: 0,
      completed: 0,
      total: 0,
      rest: 0,
    })
    expect(
      aggregateDay([daily], [log('2024-02-29', 0, true)], '2024-02-29').ratio,
    ).toBe(0)
  })
})

describe('sequências diárias', () => {
  it('não inventa histórico antes do primeiro registro e ignora logs futuros', () => {
    expect(getStreaks(daily, [], '2024-03-01')).toEqual({
      current: 0,
      best: 0,
      unit: 'dias',
    })
    expect(getStreaks(daily, [log('2024-03-02')], '2024-03-01').current).toBe(0)
    expect(
      getStreaks(daily, [log('2024-03-01'), log('2024-03-02')], '2024-03-01'),
    ).toEqual({ current: 1, best: 1, unit: 'dias' })
  })
  it('preserva a sequência enquanto o dia de hoje ainda está aberto', () => {
    const logs = [log('2024-02-28'), log('2024-02-29')]
    expect(getStreaks(daily, logs, '2024-03-01')).toEqual({
      current: 2,
      best: 2,
      unit: 'dias',
    })
    expect(getStreaks(daily, logs, '2024-03-02')).toEqual({
      current: 0,
      best: 2,
      unit: 'dias',
    })
  })
  it('descanso preserva sem incrementar e faltas reais reiniciam a contagem', () => {
    const logs = [
      log('2024-02-27'),
      log('2024-02-28', 0, true),
      log('2024-02-29'),
    ]
    expect(getStreaks(daily, logs, '2024-03-01')).toEqual({
      current: 2,
      best: 2,
      unit: 'dias',
    })
    expect(
      getStreaks(daily, [...logs, log('2024-03-02')], '2024-03-02'),
    ).toEqual({ current: 1, best: 2, unit: 'dias' })
    expect(
      getStreaks(
        daily,
        [log('2024-02-28', 0, true), log('2024-02-29', 0, true)],
        '2024-03-01',
      ).best,
    ).toBe(0)
  })
  it('quantidades parciais passadas quebram a sequência, as de hoje têm tolerância', () => {
    const logs = [
      log('2024-02-28', 3, false, water),
      log('2024-02-29', 2, false, water),
    ]
    expect(getStreaks(water, logs, '2024-02-29').current).toBe(1)
    expect(
      getStreaks(
        water,
        [...logs, log('2024-03-01', 3, false, water)],
        '2024-03-01',
      ),
    ).toEqual({ current: 1, best: 1, unit: 'dias' })
  })
  it('atravessa o ano sem interromper uma sequência', () => {
    expect(
      getStreaks(
        daily,
        [log('2024-12-30'), log('2024-12-31'), log('2025-01-01')],
        '2025-01-01',
      ).current,
    ).toBe(3)
  })
})

describe('frequência e sequências semanais', () => {
  it('conta dias concluídos, ignora outros hábitos e registros futuros', () => {
    const logs = [
      log('2024-12-30', 1, false, weekly),
      log('2024-12-31', 1, false, weekly),
      log('2025-01-02', 1, false, weekly),
      log('2025-01-01'),
    ]
    expect(weekProgress(weekly, logs, '2025-01-01')).toEqual({
      completed: 2,
      required: 3,
    })
    expect(weekProgress(weekly, logs, '2025-01-02')).toEqual({
      completed: 3,
      required: 3,
    })
  })
  it('conta semanas atingidas e concede tolerância à semana atual', () => {
    const logs = [
      '2024-02-19',
      '2024-02-21',
      '2024-02-23',
      '2024-02-26',
      '2024-02-27',
      '2024-02-29',
    ].map((date) => log(date, 1, false, weekly))
    expect(getStreaks(weekly, logs, '2024-03-04')).toEqual({
      current: 2,
      best: 2,
      unit: 'semanas',
    })
    expect(getStreaks(weekly, logs, '2024-03-11')).toEqual({
      current: 0,
      best: 2,
      unit: 'semanas',
    })
  })
  it('semanas inteiras de descanso preservam sem criar conquistas', () => {
    const fulfilled = ['2024-02-19', '2024-02-20', '2024-02-21'].map((date) =>
      log(date, 1, false, weekly),
    )
    const resting = [
      '2024-02-26',
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
    ].map((date) => log(date, 0, true, weekly))
    expect(
      getStreaks(weekly, [...fulfilled, ...resting], '2024-03-04'),
    ).toEqual({ current: 1, best: 1, unit: 'semanas' })
    expect(getStreaks(weekly, resting, '2024-03-04')).toEqual({
      current: 0,
      best: 0,
      unit: 'semanas',
    })
    expect(weekProgress(weekly, resting, '2024-03-03')).toEqual({
      completed: 0,
      required: 0,
    })
  })
  it('reduz a meta somente quando os descansos deixam menos dias elegíveis', () => {
    const resting = [
      '2024-02-26',
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ].map((date) => log(date, 0, true, weekly))
    const logs = [
      ...resting,
      log('2024-03-02', 1, false, weekly),
      log('2024-03-03', 1, false, weekly),
    ]
    expect(weekProgress(weekly, logs, '2024-03-03')).toEqual({
      completed: 2,
      required: 2,
    })
    expect(getStreaks(weekly, logs, '2024-03-03').current).toBe(1)
    expect(weekProgress(weekly, [resting[0]!], '2024-03-03').required).toBe(3)
  })
  it('retém o maior período depois de uma semana perdida e inicia um novo', () => {
    const dates = [
      '2024-02-05',
      '2024-02-06',
      '2024-02-07',
      '2024-02-12',
      '2024-02-13',
      '2024-02-14',
      '2024-02-26',
      '2024-02-27',
      '2024-02-28',
    ]
    expect(
      getStreaks(
        weekly,
        dates.map((date) => log(date, 1, false, weekly)),
        '2024-02-29',
      ),
    ).toEqual({ current: 1, best: 2, unit: 'semanas' })
  })
})
