import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TransientToast } from './TransientToast'

afterEach(() => vi.useRealTimers())

it('desaparece após oito segundos sem alterar o registro de desfazer', () => {
  vi.useFakeTimers()
  const dismiss = vi.fn()
  const undo = vi.fn()
  render(
    <TransientToast identity="task-1" onDismiss={dismiss}>
      <p role="status">Tarefa excluída.</p>
      <button onClick={undo}>Desfazer</button>
    </TransientToast>,
  )
  act(() => vi.advanceTimersByTime(7999))
  expect(screen.getByRole('status')).toBeVisible()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(dismiss).toHaveBeenCalledTimes(1)
  expect(undo).not.toHaveBeenCalled()
})

it('pausa o prazo durante foco e permite desfazer pelo teclado', () => {
  vi.useFakeTimers()
  const undo = vi.fn()
  render(
    <TransientToast identity="note-1">
      <button onClick={undo}>Desfazer</button>
    </TransientToast>,
  )
  const button = screen.getByRole('button')
  fireEvent.focus(button)
  act(() => vi.advanceTimersByTime(30_000))
  expect(button).toBeVisible()
  fireEvent.click(button)
  expect(undo).toHaveBeenCalledTimes(1)
  fireEvent.blur(button)
  act(() => vi.advanceTimersByTime(8000))
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('pausa com hover, reabre para um novo evento e mantém erros persistentes', () => {
  vi.useFakeTimers()
  const { rerender } = render(
    <TransientToast identity="a">
      <p role="status">Criado.</p>
    </TransientToast>,
  )
  fireEvent.mouseEnter(screen.getByRole('status').parentElement!)
  act(() => vi.advanceTimersByTime(20_000))
  expect(screen.getByRole('status')).toBeVisible()
  fireEvent.mouseLeave(screen.getByRole('status').parentElement!)
  act(() => vi.advanceTimersByTime(8000))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  rerender(
    <TransientToast identity="b" persistent>
      <p role="alert">Tente novamente.</p>
    </TransientToast>,
  )
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByRole('alert')).toBeVisible()
})

it('não expira enquanto o documento está oculto', () => {
  vi.useFakeTimers()
  render(
    <TransientToast identity="hidden">
      <p role="status">Registro salvo.</p>
    </TransientToast>,
  )
  const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  fireEvent(document, new Event('visibilitychange'))
  act(() => vi.advanceTimersByTime(30_000))
  expect(screen.getByRole('status')).toBeVisible()
  if (descriptor) Object.defineProperty(document, 'hidden', descriptor)
  else Reflect.deleteProperty(document, 'hidden')
})
