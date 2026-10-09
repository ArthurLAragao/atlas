import type { Habit } from '../data/models.js'
import type { RoutineConfig, ScheduleDay } from '../data/routine-models.js'

// Entirely fictional. Never load the user's private configuration in tests.
export const sampleHabit = (id = 'sample'): Habit => ({
  id,
  title: 'Hábito exemplo',
  kind: 'binary',
  target: 1,
  unit: 'vez',
  timesPerWeek: 7,
  tags: [],
  links: [],
  isExample: false,
  createdAt: '2026-01-01T12:00:00Z',
  updatedAt: '2026-01-01T12:00:00Z',
})
export function sampleRoutine(): RoutineConfig {
  const definitions = [
    'Começar o dia',
    'Movimento exemplo',
    'Hidratação exemplo',
    'Prática técnica exemplo',
    'Idioma exemplo',
    'Registro acadêmico exemplo',
    'Leitura exemplo',
    'Planejamento exemplo',
    'Pausa exemplo',
    'Encerrar telas exemplo',
    'Criação exemplo',
  ]
  return {
    format: 'atlas-weekly-routine',
    schemaVersion: 1,
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      type: `Tipo fictício ${weekday}`,
      focus: `Foco fictício ${weekday}`,
      classes:
        weekday >= 1 && weekday <= 4
          ? [
              { title: 'Disciplina exemplo A', start: '16:10', end: '17:40' },
              { title: 'Disciplina exemplo B', start: '17:40', end: '19:10' },
            ]
          : [],
      planning: [],
    })),
    habits: definitions.map((title, index) => {
      const days: ScheduleDay[] = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        label: `${title} ${weekday}`,
        time:
          index === 2
            ? null
            : index === 9 && (weekday === 5 || weekday === 6)
              ? '01:45'
              : `${String(6 + index).padStart(2, '0')}:15`,
        dayOffset: index === 9 && (weekday === 5 || weekday === 6) ? 1 : 0,
        order: index,
        optional:
          (weekday === 0 || weekday === 6) && [1, 3, 4, 6, 10].includes(index),
      })).filter((d) =>
        index === 5
          ? d.weekday >= 1 && d.weekday <= 4
          : index === 7
            ? [0, 5].includes(d.weekday)
            : index === 10
              ? d.weekday === 6
              : true,
      )
      return {
        key: `sample-${index}`,
        title,
        kind: index === 2 ? 'quantity' : 'binary',
        target: index === 2 ? 2.5 : 1,
        unit: index === 2 ? 'L' : 'vez',
        schedule: {
          mode: [5, 7, 10].includes(index) ? 'weekdays' : 'daily',
          timesPerWeek: 7,
          days,
        },
      }
    }),
  }
}
