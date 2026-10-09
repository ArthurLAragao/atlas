import { describe, expect, it } from 'vitest'
import { emptySnapshot, type HabitLog } from '../data/models'
import { sampleHabit, sampleRoutine } from '../test/routine-fixture'
import {
  applyRoutinePlan,
  editHabitSchedule,
  parseRoutineConfig,
} from './routine'
import {
  plannedTime,
  previousNight,
  routineDay,
  scheduledDay,
  scheduledHabits,
  withSchedule,
} from './habit-schedule'
import {
  aggregateDay,
  generateHeatmap,
  getStreaks,
  habitDay,
  weekProgress,
} from './habits'
import {
  decodeBackup,
  encodeBackup,
  encodeMarkdown,
  parseImport,
} from './transfer'
const today = '2026-10-05'
const now = `${today}T12:00:00Z`
const config = sampleRoutine()
const data = applyRoutinePlan(
  emptySnapshot(),
  config,
  config.habits.map((h) => ({
    key: h.key,
    habitId: null,
    expectedUpdatedAt: null,
  })),
  today,
  now,
  config.habits.map((h) => h.key),
)
const log = (
  date: string,
  habitId: string,
  value = 1,
  rest = false,
): HabitLog => ({
  ...sampleHabit(),
  id: `${habitId}-${date}`,
  habitId,
  date,
  value,
  rest,
})

describe('programação versionada e calendário local', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])(
    'seleciona o dia %s, com labels diferentes e um só ID',
    (weekday) => {
      const date = `2026-10-${String(weekday === 0 ? 11 : 4 + weekday).padStart(2, '0')}`
      expect(routineDay(data.routine, date)?.weekday).toBe(weekday)
      const habit = data.habits[0]!
      expect(scheduledDay(habit, date).label).toBe(
        `${config.habits[0]!.title} ${weekday}`,
      )
      expect(habit.id).toBe('sample-0')
      expect(
        scheduledHabits(data.habits, date).some((h) => h.id === 'sample-6'),
      ).toBe(weekday >= 1 && weekday <= 5)
    },
  )
  it('distingue dias fixos de frequência flexível', () => {
    const h = withSchedule(
      sampleHabit(),
      {
        mode: 'weekdays',
        timesPerWeek: 3,
        days: [1, 3, 5].map((weekday) => ({
          weekday,
          time: null,
          dayOffset: 0,
          order: 0,
          optional: false,
        })),
      },
      today,
    )
    const entries = [
      log(today, h.id),
      log('2026-10-07', h.id),
      log('2026-10-09', h.id),
    ]
    expect(getStreaks(h, entries, '2026-10-11')).toEqual({
      current: 3,
      best: 3,
      unit: 'ocorrências',
    })
    expect(weekProgress(h, entries, '2026-10-11')).toEqual({
      completed: 3,
      required: 3,
    })
    const flexible = { ...sampleHabit(), timesPerWeek: 3 }
    expect(getStreaks(flexible, entries, '2026-10-11')).toEqual({
      current: 1,
      best: 1,
      unit: 'semanas',
    })
    expect(scheduledDay(h, '2026-10-06').scheduled).toBe(false)
    const flexibleVariation = withSchedule(
      flexible,
      {
        mode: 'flexible',
        timesPerWeek: 3,
        days: [
          {
            weekday: 1,
            label: 'Prática livre',
            time: '11:20',
            dayOffset: 0,
            order: 0,
            optional: false,
          },
        ],
      },
      today,
    )
    expect(scheduledDay(flexibleVariation, today).label).toBe('Prática livre')
    expect(scheduledDay(flexibleVariation, '2026-10-06').scheduled).toBe(true)
    expect(scheduledDay(flexibleVariation, '2026-10-06').mode).toBe('flexible')
  })
  it('não penaliza opcionais, descanso ou dias sem programação', () => {
    const weekend = '2026-10-10'
    expect(
      scheduledHabits(data.habits, weekend, true).map((h) => h.id),
    ).toEqual(
      expect.arrayContaining([
        'sample-1',
        'sample-3',
        'sample-4',
        'sample-6',
        'sample-10',
      ]),
    )
    const onlyOptional = [data.habits[10]!]
    expect(aggregateDay(onlyOptional, [], weekend)).toEqual({
      ratio: 0,
      completed: 0,
      total: 0,
      rest: 0,
    })
    expect(
      aggregateDay(onlyOptional, [log(weekend, 'sample-10')], weekend).ratio,
    ).toBe(0)
    expect(aggregateDay([data.habits[5]!], [], '2026-10-09').total).toBe(0)
    const h = data.habits[7]!
    expect(
      getStreaks(
        h,
        [log('2026-10-09', h.id), log('2026-10-11', h.id, 0, true)],
        '2026-10-12',
      ).current,
    ).toBe(1)
  })
  it('atribui madrugada à sexta/sábado e mantém água em posição consistente', () => {
    const h = data.habits[9]!
    expect(scheduledDay(h, '2026-10-09').dayOffset).toBe(1)
    expect(plannedTime(scheduledDay(h, '2026-10-09'))).toContain('dia seguinte')
    expect(previousNight(data.habits, '2026-10-10').date).toBe('2026-10-09')
    expect(
      previousNight(data.habits, '2026-10-10').habits.map((h) => h.id),
    ).toEqual(['sample-9'])
    expect(previousNight(data.habits, '2026-10-12').habits).toEqual([])
    expect(scheduledHabits(data.habits, '2026-10-09').at(-1)?.id).toBe(h.id)
    expect(scheduledDay(data.habits[2]!, today).time).toBeNull()
  })
  it.each(['daily', 'flexible'] as const)(
    'timesPerWeek 7 no modo %s não exige opcionais no fim de semana',
    (mode) => {
      const habit = withSchedule(
        sampleHabit(),
        {
          mode,
          timesPerWeek: 7,
          days: [0, 6].map((weekday) => ({
            weekday,
            time: null,
            dayOffset: 0,
            order: 0,
            optional: true,
          })),
        },
        today,
      )
      const weekdays = [5, 6, 7, 8, 9].map((day) =>
        log(`2026-10-${String(day).padStart(2, '0')}`, habit.id),
      )
      expect(weekProgress(habit, weekdays, '2026-10-11')).toEqual({
        completed: 5,
        required: 5,
      })
      expect(getStreaks(habit, weekdays, '2026-10-12').current).toBe(
        mode === 'daily' ? 5 : 1,
      )
      for (const date of ['2026-10-10', '2026-10-11']) {
        expect(scheduledHabits([habit], date)).toEqual([])
        expect(scheduledHabits([habit], date, true)).toEqual([habit])
        expect(aggregateDay([habit], weekdays, date)).toEqual({
          completed: 0,
          total: 0,
          ratio: 0,
          rest: 0,
        })
      }
      expect(
        weekProgress(
          habit,
          [...weekdays, log('2026-10-10', habit.id)],
          '2026-10-11',
        ),
      ).toEqual({ completed: 5, required: 5 })
    },
  )
  it('ordena horário e deslocamento antes de order e mantém desempate estável', () => {
    const planned = (
      id: string,
      time: string | null,
      dayOffset: 0 | 1,
      order: number,
    ) =>
      withSchedule(
        sampleHabit(id),
        {
          mode: 'daily',
          timesPerWeek: 7,
          days: [{ weekday: 5, time, dayOffset, order, optional: false }],
        },
        today,
      )
    const habits = [
      planned('late', '02:30', 1, 0),
      planned('evening', '23:30', 0, 1),
      planned('morning-b', '07:00', 0, 100),
      planned('morning-a', '07:00', 0, 100),
      planned('morning-first', '07:00', 0, 99),
      planned('untimed', null, 0, 0),
      planned('early', '02:30', 0, 999),
    ]
    const expected = [
      'early',
      'morning-first',
      'morning-a',
      'morning-b',
      'untimed',
      'evening',
      'late',
    ]
    expect(scheduledHabits(habits, '2026-10-09').map((h) => h.id)).toEqual(
      expected,
    )
    expect(
      scheduledHabits([...habits].reverse(), '2026-10-09').map((h) => h.id),
    ).toEqual(expected)
    expect(habits[0]?.id).toBe('late')
  })
  it('conserva alvo, unidade e programação anteriores à vigência', () => {
    const old = {
      ...sampleHabit(),
      kind: 'quantity' as const,
      target: 5,
      unit: 'L',
    }
    const next = editHabitSchedule(
      old,
      { ...old, target: 2.5, timesPerWeek: 3 },
      today,
    )
    expect(scheduledDay(next, '2026-10-04').target).toBe(5)
    expect(
      habitDay(next, [log('2026-10-04', next.id, 2.5)], '2026-10-04').completed,
    ).toBe(false)
    expect(scheduledDay(next, today).target).toBe(2.5)
    expect(scheduledDay(next, '2026-10-04').mode).toBe('daily')
    expect(scheduledDay(next, today).mode).toBe('flexible')
    const tampered = {
      ...next,
      scheduleVersions: next.scheduleVersions!.map((v) => ({
        ...v,
        target: 100,
      })),
    }
    expect(() => editHabitSchedule(next, tampered, '2026-10-06')).toThrow(
      'Versões anteriores',
    )
  })
  it('grid distingue dia não programado do dia previsto vazio', () => {
    const h = data.habits[7]!
    const cells = generateHeatmap('2026-10-11', 1).flat()
    expect(
      cells.filter((d) => scheduledDay(h, d.date).scheduled).map((d) => d.date),
    ).toEqual(['2026-10-09', '2026-10-11'])
    expect(aggregateDay([h], [], '2026-10-08').total).toBe(0)
    expect(aggregateDay([h], [], '2026-10-09')).toEqual({
      ratio: 0,
      completed: 0,
      total: 1,
      rest: 0,
    })
  })
  it('separa semanas flexíveis de ocorrências fixas ao trocar programação no meio da semana', () => {
    const flexible = { ...sampleHabit(), timesPerWeek: 2 }
    const fixed = withSchedule(
      flexible,
      {
        mode: 'weekdays',
        timesPerWeek: 2,
        days: [5, 0].map((weekday) => ({
          weekday,
          time: null,
          dayOffset: 0,
          order: 0,
          optional: false,
        })),
      },
      '2026-10-09',
    )
    const entries = ['2026-10-05', '2026-10-06', '2026-10-09'].map((d) =>
      log(d, fixed.id),
    )
    expect(weekProgress(fixed, entries, '2026-10-08')).toEqual({
      completed: 2,
      required: 2,
    })
    expect(weekProgress(fixed, entries, '2026-10-09')).toEqual({
      completed: 1,
      required: 2,
    })
    expect(getStreaks(fixed, entries, '2026-10-09')).toEqual({
      current: 1,
      best: 1,
      unit: 'ocorrências',
    })
    expect(scheduledDay(fixed, '2026-10-06').mode).toBe('flexible')
    expect(scheduledDay(fixed, '2026-10-10').scheduled).toBe(false)
  })
  it('backup JSON e Atlas Markdown conservam rotina, versões e IDs; nota individual não representa rotina', () => {
    expect(decodeBackup(encodeBackup(data))).toEqual(data)
    expect(parseImport(encodeMarkdown(data), 'backup.md')).toEqual(data)
    expect(parseImport('# Nota comum', 'nota.md').routine).toBeUndefined()
    expect(decodeBackup(encodeBackup(emptySnapshot())).routine).toBeUndefined()
  })
  it('valida configurações inválidas e não funde histórias por título', () => {
    expect(parseRoutineConfig(JSON.stringify(config))).toEqual(config)
    expect(() => parseRoutineConfig('{')).toThrow('ilegível')
    expect(() => parseRoutineConfig('x'.repeat(1024 * 1024 + 1))).toThrow(
      '1 MB',
    )
    expect(() =>
      parseRoutineConfig(JSON.stringify({ ...config, days: [config.days[0]] })),
    ).toThrow('Rotina inválida')
    expect(() =>
      parseRoutineConfig(
        JSON.stringify({
          ...config,
          habits: [
            {
              ...config.habits[0],
              schedule: { mode: 'weekdays', timesPerWeek: 3, days: [] },
            },
          ],
        }),
      ),
    ).toThrow('Rotina inválida')
    const existing = {
      ...emptySnapshot(),
      habits: [{ ...sampleHabit('existing'), title: config.habits[0]!.title }],
    }
    const next = applyRoutinePlan(
      existing,
      config,
      config.habits.map((h) => ({
        key: h.key,
        habitId: null,
        expectedUpdatedAt: null,
      })),
      today,
      now,
      config.habits.map((h) => h.key),
    )
    expect(next.habits).toHaveLength(12)
    expect(next.habits[0]).toEqual(existing.habits[0])
    const repeated = config.habits.map((h) => ({
      key: h.key,
      habitId: 'existing',
      expectedUpdatedAt: existing.habits[0]!.updatedAt,
    }))
    expect(() =>
      applyRoutinePlan(existing, config, repeated, today, now, []),
    ).toThrow('mesmo histórico')
  })
})
