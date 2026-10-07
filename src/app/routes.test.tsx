// This suite verifies keyboard navigation/focus, not Vite cold transforms.
// Real route loading and splitting remain covered by production browser tests.
import '../features/today/TodayPage'
import '../features/habits/HabitsPage'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { ThemeSync } from './ThemeSync'
import { usePreferences } from './preferences-store'
import { defaultPreferences, preferencesKey } from '../lib/preferences'

beforeEach(() => {
  localStorage.clear()
  usePreferences.setState({
    preferences: { ...defaultPreferences },
    storageFailed: false,
  })
})

it('navega por teclado e move o foco para o título da rota', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AppRoutes />
    </MemoryRouter>,
  )
  // Today now imports the task and habit controls in its route chunk.
  await screen.findByRole(
    'heading',
    {
      level: 1,
      name: 'Hoje',
    },
    { timeout: 5000 },
  )
  const navigation = screen.getByRole('navigation', {
    name: 'Navegação principal',
  })
  within(navigation).getByRole('link', { name: 'Hábitos' }).focus()
  await user.keyboard('{Enter}')
  // The feature chunk includes charts and motion; allow its cold module import.
  const heading = await screen.findByRole(
    'heading',
    {
      level: 1,
      name: 'Hábitos',
    },
    { timeout: 5000 },
  )
  expect(heading).toHaveFocus()
  expect(
    within(navigation).getByRole('link', { name: 'Hábitos' }),
  ).toHaveAttribute('aria-current', 'page')
})

it('altera tema, salva preferências e devolve foco ao fechar com Escape', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ThemeSync />
      <AppRoutes />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1 })
  await user.click(screen.getByRole('button', { name: 'Aparência' }))
  await user.click(screen.getByRole('radio', { name: 'Claro' }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(
    JSON.parse(localStorage.getItem(preferencesKey) ?? '{}'),
  ).toMatchObject({ theme: 'light' })
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('radio', { name: 'Claro' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Aparência' })).toHaveFocus()
})

it('mantém a sessão utilizável quando o armazenamento é bloqueado', async () => {
  const user = userEvent.setup()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  render(
    <MemoryRouter>
      <ThemeSync />
      <AppRoutes />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1 })
  await user.click(screen.getByRole('button', { name: 'Aparência' }))
  await user.click(screen.getByRole('radio', { name: 'Claro' }))
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(screen.getByText(/O navegador bloqueou/)).toBeInTheDocument()
  spy.mockRestore()
})

it('oferece recuperação para endereço desconhecido', async () => {
  render(
    <MemoryRouter initialEntries={['/nao-existe']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
    'Página não encontrada',
  )
  expect(
    screen.getByRole('link', { name: 'Voltar para Hoje' }),
  ).toHaveAttribute('href', '/')
})
