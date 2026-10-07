import { afterEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useData } from '../app/data-store'
import { DataProvider } from './DataProvider'

vi.mock('../app/data-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/data-store')>()),
  connectData: vi.fn(() => () => {}),
}))

const initial = useData.getState()
afterEach(() => useData.setState(initial))
it('abertura mantém landmark principal separado do anúncio de carregamento', () => {
  useData.setState({ status: 'loading' })
  render(
    <DataProvider>
      <p>Conteúdo pronto</p>
    </DataProvider>,
  )
  expect(screen.getByRole('main')).toContainElement(screen.getByRole('status'))
  expect(screen.getByRole('status')).toHaveTextContent(
    'Abrindo seus dados locais',
  )
  expect(screen.queryByText('Conteúdo pronto')).not.toBeInTheDocument()
})
