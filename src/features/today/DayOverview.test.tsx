import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { DayOverview } from './DayOverview'
import { useNotes } from '../notes/note-store'

afterEach(() => vi.restoreAllMocks())

it('salva o registro apenas por ação explícita e mantém uma identidade por dia', async () => {
  const save = vi.spyOn(useNotes.getState(), 'save').mockImplementation(async (note) => note)
  render(<MemoryRouter><DayOverview today="2026-11-03" pending={2} completed={1} habitsDone={1} habitsTotal={3} /></MemoryRouter>)
  fireEvent.change(screen.getByRole('textbox', { name: 'Anotações do dia' }), { target: { value: 'Praticar filas — registro fictício.' } })
  expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Salvar registro' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'day-note-2026-11-03', content: 'Praticar filas — registro fictício.' }), null))
  expect(screen.getByRole('status')).toHaveTextContent('Registro salvo nas notas do Atlas')
})
