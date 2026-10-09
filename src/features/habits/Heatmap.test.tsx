import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Heatmap } from './Heatmap'
import { sampleHabit } from '../../test/routine-fixture'
import { withSchedule } from '../../lib/habit-schedule'

it('distingue sem programação, dia previsto vazio e versão do alvo na alternativa textual', () => {
  const habit = withSchedule(
    sampleHabit(),
    {
      mode: 'weekdays',
      timesPerWeek: 1,
      days: [
        { weekday: 5, time: null, dayOffset: 0, order: 0, optional: false },
      ],
    },
    '2026-10-05',
  )
  render(
    <Heatmap
      habits={[habit]}
      logs={[]}
      habit={habit}
      today="2026-10-11"
      weeks={1}
      onEdit={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ver em texto' }))
  expect(
    screen.getAllByText('Sem programação · registros eventuais preservados'),
  ).toHaveLength(6)
  expect(screen.getByText('Não concluído')).toBeVisible()
  expect(screen.getByText(/alvo vigente em cada data/)).toBeVisible()
})

it('marca descanso dos obrigatórios sem incluir opcionais no denominador', () => {
  const required = sampleHabit('required')
  const optional = withSchedule(
    sampleHabit('optional'),
    {
      mode: 'daily',
      timesPerWeek: 7,
      days: [
        { weekday: 5, time: null, dayOffset: 0, order: 0, optional: true },
      ],
    },
    '2026-10-05',
  )
  render(
    <Heatmap
      habits={[required, optional]}
      logs={[
        {
          ...sampleHabit('log'),
          habitId: required.id,
          date: '2026-10-09',
          value: 0,
          rest: true,
        },
      ]}
      today="2026-10-09"
      weeks={1}
      onEdit={vi.fn()}
    />,
  )
  const day = screen.getByRole('button', {
    name: /sexta-feira, 9 de outubro.*0 de 1 hábitos concluídos.*1 em descanso/,
  })
  expect(day.querySelector('.heatmap-mark')).toHaveAttribute(
    'data-rest',
    'true',
  )
  expect(day.querySelector('.heatmap-mark')).toHaveAttribute(
    'data-unscheduled',
    'false',
  )
})

it('mantém o valor parcial de um opcional visível no histórico textual', () => {
  const habit = withSchedule(
    { ...sampleHabit(), kind: 'quantity', target: 2.5, unit: 'L' },
    {
      mode: 'daily',
      timesPerWeek: 7,
      days: [
        { weekday: 5, time: null, dayOffset: 0, order: 0, optional: true },
      ],
    },
    '2026-10-05',
  )
  render(
    <Heatmap
      habits={[habit]}
      habit={habit}
      logs={[
        {
          ...sampleHabit('log'),
          habitId: habit.id,
          date: '2026-10-09',
          value: 0.5,
          rest: false,
        },
      ]}
      today="2026-10-09"
      weeks={1}
      onEdit={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Ver em texto' }))
  expect(
    screen.getByText('Opcional · 0,5 de 2,5 L · fora do progresso obrigatório'),
  ).toBeVisible()
})
