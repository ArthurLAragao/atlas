import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useData } from '../../app/data-store'
import { emptySnapshot } from '../../data/models'
import { defaultProfile } from '../../data/profile-models'
import { useTasks } from '../tasks/task-store'
import { useHabits } from '../habits/habit-store'
import TodayPage from './TodayPage'

beforeEach(() => {
  useData.setState({ data: emptySnapshot(), status: 'ready', busy: false })
  vi.spyOn(useTasks.getState(), 'refreshUndo').mockResolvedValue(undefined)
  vi.spyOn(useHabits.getState(), 'refreshUndo').mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())

function openToday() {
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  )
}

describe('saudação local de Hoje', () => {
  it.each([null, { ...defaultProfile(), name: '   ' }])(
    'usa saudação neutra sem nome de exibição: %j',
    (profile) => {
      useData.setState({ data: { ...emptySnapshot(), profile } })
      openToday()
      expect(
        screen.getByText(
          'Um dia de cada vez. Escolha poucos passos e deixe espaço para respirar.',
        ),
      ).toBeVisible()
    },
  )
  it('acompanha o perfil existente, aparando espaços, sem usar identificador', () => {
    useData.setState({
      data: {
        ...emptySnapshot(),
        profile: {
          ...defaultProfile(),
          name: ' Pessoa Exemplo ',
          handle: '@outra-coisa',
        },
      },
    })
    openToday()
    expect(
      screen.getByText(/^Um dia de cada vez, Pessoa Exemplo\./),
    ).toBeVisible()
    act(() =>
      useData.setState({
        data: {
          ...emptySnapshot(),
          profile: {
            ...defaultProfile(),
            name: 'Outra Pessoa',
          },
        },
      }),
    )
    expect(
      screen.getByText(/^Um dia de cada vez, Outra Pessoa\./),
    ).toBeVisible()
    act(() => useData.setState({ data: emptySnapshot() }))
    expect(screen.getByText(/^Um dia de cada vez\. Escolha/)).toBeVisible()
  })
  it('renderiza nome como texto, sem interpretar marcação', () => {
    useData.setState({
      data: {
        ...emptySnapshot(),
        profile: {
          ...defaultProfile(),
          name: '<b>Pessoa Exemplo</b>',
        },
      },
    })
    openToday()
    const greeting = screen.getByText(
      /^Um dia de cada vez, <b>Pessoa Exemplo<\/b>\./,
    )
    expect(greeting).toBeVisible()
    expect(greeting.querySelector('b')).toBeNull()
  })
})
