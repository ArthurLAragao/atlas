import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SelectMenu } from './SelectMenu'

const options = [
  { value: 'todo', label: 'A fazer' },
  { value: 'doing', label: 'Fazendo' },
  { value: 'done', label: 'Feito' },
]

it('abre a opção atual, percorre por teclado e confirma uma escolha explícita', () => {
  const change = vi.fn()
  render(
    <SelectMenu
      label="Situação"
      value="todo"
      options={options}
      onChange={change}
    />,
  )
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
  const current = screen.getByRole('option', { name: 'A fazer' })
  expect(current).toHaveFocus()
  fireEvent.keyDown(current, { key: 'ArrowDown' })
  expect(screen.getByRole('option', { name: 'Fazendo' })).toHaveFocus()
  expect(change).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('option', { name: 'Fazendo' }))
  expect(change).toHaveBeenCalledWith('doing')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

it('Home/End e busca por letra funcionam; Escape cancela sem mudar o valor', () => {
  const change = vi.fn()
  render(
    <SelectMenu
      label="Situação"
      value="doing"
      options={options}
      onChange={change}
    />,
  )
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.keyDown(screen.getByRole('option', { name: 'Fazendo' }), {
    key: 'End',
  })
  expect(screen.getByRole('option', { name: 'Feito' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  expect(screen.getByRole('option', { name: 'A fazer' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'f' })
  expect(screen.getByRole('option', { name: 'Fazendo' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(change).not.toHaveBeenCalled()
})
