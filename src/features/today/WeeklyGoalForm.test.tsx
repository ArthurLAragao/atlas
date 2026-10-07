import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { buildSeed } from '../../data/seed'
import type { Goal } from '../../data/models'
import { WeeklyGoalForm } from './WeeklyGoalForm'
import { useToday } from './today-store'

const timestamp = '2026-10-02T12:00:00.000Z'
function existing(deadline: string | null = null): Goal {
  return {
    ...buildSeed(new Date(timestamp)).goals[0]!,
    title: 'Concluir trilha AWS',
    description: 'Estudar, praticar e registrar.',
    status: 'completed',
    weekly: false,
    deadline,
    tags: ['cloud'],
    links: [{ type: 'projects', id: 'example-project' }],
    keyResults: [
      {
        id: 'modules',
        title: 'Completar módulos',
        current: 3,
        target: 10,
        unit: 'módulos',
      },
      {
        id: 'hours',
        title: 'Horas de estudo',
        current: 8,
        target: 30,
        unit: 'h',
      },
    ],
  }
}
beforeEach(() => {
  useData.setState({
    data: buildSeed(new Date(timestamp)),
    busy: false,
    status: 'ready',
    error: null,
    message: '',
  })
  useToday.setState({ error: null, message: '' })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('escolher uma meta existente em Hoje', () => {
  it('criar uma meta nova no Hoje sugere domingo e define a escolha explicitamente', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(timestamp))
    const save = vi
      .spyOn(useToday.getState(), 'saveGoal')
      .mockResolvedValueOnce(true)
    const close = vi.fn()
    render(<WeeklyGoalForm onClose={close} />)
    fireEvent.change(screen.getByLabelText('Nome da meta'), {
      target: { value: 'Praticar cloud esta semana' },
    })
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Salvar meta' }).closest('form')!,
      )
    })
    expect(save).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        title: 'Praticar cloud esta semana',
        deadline: '2026-10-04',
        weekly: true,
        status: 'active',
        keyResults: [],
        isExample: false,
      }),
    )
    expect(close).toHaveBeenCalledTimes(1)
  })
  it.each([null, '2026-12-30'])(
    'preserva prazo %s, medidas e campos novos ao definir a escolha semanal',
    async (deadline) => {
      const original = existing(deadline)
      useData.setState({
        data: { ...useData.getState().data, goals: [original] },
      })
      const operation = vi
        .spyOn(useToday.getState(), 'saveGoal')
        .mockResolvedValueOnce(true)
      const onClose = vi.fn()
      render(<WeeklyGoalForm onClose={onClose} />)
      fireEvent.change(screen.getByLabelText('Usar meta existente'), {
        target: { value: original.id },
      })
      expect(screen.getByLabelText('Nome da meta')).toHaveValue(original.title)
      await act(async () => {
        fireEvent.submit(
          screen.getByRole('button', { name: 'Salvar meta' }).closest('form')!,
        )
      })
      expect(operation).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          ...original,
          weekly: true,
          isExample: false,
          tags: ['cloud', 'semana'],
        }),
      )
      expect(onClose).toHaveBeenCalledTimes(1)
    },
  )

  it('editar nome de uma meta semanal sem prazo não cria um prazo implícito', async () => {
    const original = { ...existing(), weekly: true }
    const operation = vi
      .spyOn(useToday.getState(), 'saveGoal')
      .mockResolvedValueOnce(true)
    render(<WeeklyGoalForm goal={original} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nome da meta'), {
      target: { value: 'Meu objetivo atualizado' },
    })
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Salvar meta' }).closest('form')!,
      )
    })
    expect(operation).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        ...original,
        title: 'Meu objetivo atualizado',
        deadline: null,
        weekly: true,
        isExample: false,
        tags: ['cloud', 'semana'],
      }),
    )
  })
})
