// Prepare lazy modules during collection; assertion clocks measure interaction.
import './ConfirmDialog'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompactCapture } from './CompactCapture'
function Capture({ create }: { create: () => Promise<boolean> }) {
  const [value, setValue] = useState('')
  return (
    <CompactCapture
      label="Captura rápida"
      placeholder="Adicionar tarefa…"
      value={value}
      onChange={setValue}
      onCreate={create}
      busy={false}
    >
      <p>Mais opções</p>
    </CompactCapture>
  )
}
it('foco expande imediatamente; Escape com texto pede descarte e preserva ao cancelar', async () => {
  const user = userEvent.setup()
  render(<Capture create={vi.fn().mockResolvedValue(true)} />)
  const input = screen.getByRole('textbox', { name: 'Captura rápida' })
  expect(
    screen.getByRole('button', {
      name: /^(Expandir|Recolher) captura rápida$/,
    }),
  ).toHaveAttribute('aria-expanded', 'false')
  await user.type(input, 'Estudar AWS')
  expect(input).toHaveFocus()
  expect(
    screen.getByRole('button', {
      name: /^(Expandir|Recolher) captura rápida$/,
    }),
  ).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(await screen.findByRole('button', { name: 'Cancelar' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(input).toHaveValue('Estudar AWS')
  expect(input).toHaveFocus()
  await user.keyboard('{Escape}')
  await user.click(await screen.findByRole('button', { name: 'Descartar' }))
  expect(input).toHaveValue('')
  expect(
    screen.getByRole('button', {
      name: /^(Expandir|Recolher) captura rápida$/,
    }),
  ).toHaveAttribute('aria-expanded', 'false')
})
it('Shift+Enter não cria; falha preserva a captura', async () => {
  const user = userEvent.setup(),
    create = vi.fn().mockResolvedValue(false)
  render(<Capture create={create} />)
  const input = screen.getByRole('textbox', { name: 'Captura rápida' })
  await user.type(input, 'Ler')
  await user.keyboard('{Shift>}{Enter}{/Shift}')
  expect(create).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(create).toHaveBeenCalledOnce()
  expect(input).toHaveValue('Ler')
  expect(
    screen.getByRole('button', {
      name: /^(Expandir|Recolher) captura rápida$/,
    }),
  ).toHaveAttribute('aria-expanded', 'true')
})
