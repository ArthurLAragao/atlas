// Prepare lazy modules during collection; assertion clocks measure interaction.
import './ConfirmDialog'
import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmAction } from './ConfirmAction'
it('confirmação inicia em Cancelar, Escape devolve foco e só exclui explicitamente', async () => {
  const user = userEvent.setup(),
    remove = vi.fn().mockResolvedValue(true)
  render(
    <ConfirmAction title="Excluir esta nota?" name="Aula" onConfirm={remove}>
      Excluir nota
    </ConfirmAction>,
  )
  const trigger = screen.getByRole('button', { name: 'Excluir nota' })
  await user.click(trigger)
  expect(await screen.findByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(remove).not.toHaveBeenCalled()
  expect(trigger).toHaveFocus()
  await user.click(trigger)
  await screen.findByRole('alertdialog')
  await user.keyboard('{Escape}')
  expect(trigger).toHaveFocus()
  await user.click(trigger)
  await user.click(await screen.findByRole('button', { name: 'Excluir' }))
  expect(remove).toHaveBeenCalledTimes(1)
})
