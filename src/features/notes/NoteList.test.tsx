// Prepare lazy modules during collection; assertion clocks measure interaction.
import './NotePreview'
import { afterEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NoteList } from './NoteList'
import { buildSeed } from '../../data/seed'
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
it('cria a prévia somente após 600 ms e cancela uma intenção interrompida', async () => {
  vi.useFakeTimers()
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: true,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
  // jsdom lacks PointerEvent; MouseEvent preserves pointerType for this interaction.
  class TestPointer extends MouseEvent {
    pointerType = 'mouse'
  }
  vi.stubGlobal('PointerEvent', TestPointer)
  const { container, unmount } = render(
    <MemoryRouter>
      <NoteList notes={[buildSeed().notes[0]!]} />
    </MemoryRouter>,
  )
  const row = container.querySelector('.note-row-group')!
  fireEvent.pointerEnter(row, { clientX: 100, clientY: 100 })
  await act(async () => {
    vi.advanceTimersByTime(599)
  })
  expect(document.querySelector('.note-hover-preview')).toBeNull()
  fireEvent.pointerLeave(row)
  await act(async () => {
    vi.advanceTimersByTime(601)
  })
  expect(document.querySelector('.note-hover-preview')).toBeNull()
  fireEvent.pointerEnter(row, { clientX: 100, clientY: 100 })
  await act(async () => {
    vi.advanceTimersByTime(600)
    await Promise.resolve()
  })
  expect(document.querySelector('.note-hover-preview')).not.toBeNull()
  fireEvent.wheel(window)
  expect(document.querySelector('.note-hover-preview')).toBeNull()
  expect(screen.getByRole('button', { name: /^Mostrar prévia/ })).toBeVisible()
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  vi.unstubAllGlobals()
})
