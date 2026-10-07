import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCommands } from '../app/command-store'
import { SeekCapture } from './SeekCapture'

beforeEach(() => {
  useCommands.getState().closePalette()
})

it('expande, foca imediatamente, encaminha o texto sem criar dados', async () => {
  render(<SeekCapture />)
  const trigger = screen.getByRole('button', { name: 'Capturar ou navegar' })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  await act(
    async () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  )
  const input = screen.getByRole('textbox', { name: 'Captura global' })
  expect(input).toHaveFocus()
  fireEvent.change(input, { target: { value: 'nota: Redes' } })
  fireEvent.click(screen.getByRole('button', { name: 'Abrir captura e busca' }))
  expect(useCommands.getState()).toMatchObject({
    palette: true,
    query: 'nota: Redes',
  })
})

it('Escape preserva o rascunho, recolhe e devolve foco', async () => {
  const open = vi.spyOn(useCommands.getState(), 'openPalette')
  render(<SeekCapture />)
  fireEvent.click(screen.getByRole('button', { name: 'Capturar ou navegar' }))
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Ideia em andamento' },
  })
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
  await act(
    async () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  )
  expect(
    screen.getByRole('button', { name: 'Capturar ou navegar' }),
  ).toHaveFocus()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Capturar ou navegar' }))
  expect(screen.getByRole('textbox')).toHaveValue('Ideia em andamento')
  expect(open).not.toHaveBeenCalled()
  open.mockRestore()
})
