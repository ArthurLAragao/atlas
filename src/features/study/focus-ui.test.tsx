import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import FocusPage from './FocusPage'
import { FlashcardForm } from './FlashcardForm'
import { useData } from '../../app/data-store'
import { useLearning } from './learning-store'
import { repository } from '../../data/service'
import { buildSeed } from '../../data/seed'
import { usePreferences } from '../../app/preferences-store'
import { defaultPreferences } from '../../lib/preferences'
import type { Snapshot } from '../../data/models'
import { focusSessionSchema } from '../../data/models'

beforeEach(() => {
  vi.spyOn(repository, 'canUndoFocusTask').mockResolvedValue(false)
  useData.setState({ data: buildSeed(), busy: false, status: 'ready' })
  useLearning.setState({
    error: '',
    message: '',
    canUndo: false,
    canUndoFocus: false,
  })
  usePreferences.setState({
    preferences: defaultPreferences,
    storageFailed: false,
  })
})
afterEach(() => vi.restoreAllMocks())
it('Escape já consumido ao fechar um diálogo não reabre a confirmação', () => {
  const timestamp = new Date().toISOString()
  useData.setState({
    data: {
      ...useData.getState().data,
      focusSessions: [
        focusSessionSchema.parse({
          id: 'active',
          title: 'Foco',
          tags: [],
          links: [],
          isExample: false,
          createdAt: timestamp,
          updatedAt: timestamp,
          startedAt: timestamp,
          mode: 'focus',
          plannedSeconds: 1500,
          taskId: null,
          elapsedMs: 0,
          status: 'in-progress',
          timerState: 'running',
          segmentStartedAt: timestamp,
          endedAt: null,
        }),
      ],
    },
  })
  render(
    <MemoryRouter>
      <FocusPage />
    </MemoryRouter>,
  )
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  })
  event.preventDefault()
  fireEvent(document, event)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
it('Space ignora campos e diálogos, mas inicia a sessão fora de um campo', async () => {
  const start = vi
    .spyOn(repository, 'startFocus')
    .mockResolvedValue(useData.getState().data)
  vi.spyOn(repository, 'canUndoFlashcard').mockResolvedValue(false)
  render(
    <MemoryRouter>
      <FocusPage />
    </MemoryRouter>,
  )
  fireEvent.keyDown(screen.getByLabelText('Tarefa vinculada'), {
    code: 'Space',
    key: ' ',
  })
  expect(start).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Iniciar' }), {
    code: 'Space',
    key: ' ',
  })
  expect(start).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.keyDown(screen.getByRole('heading', { name: 'Foco' }), {
      code: 'Space',
      key: ' ',
    })
  })
  expect(start).toHaveBeenCalledTimes(1)
  expect(start).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: 'focus',
      plannedSeconds: 1500,
      taskId: null,
    }),
  )
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  document.body.append(dialog)
  fireEvent.keyDown(document, { code: 'Space', key: ' ' })
  expect(start).toHaveBeenCalledTimes(1)
  dialog.remove()
})
it('flashcard mantém pergunta e resposta diante de falha, sem fechar formulário', async () => {
  const before = useData.getState().data
  vi.spyOn(repository, 'saveFlashcard').mockRejectedValue(
    new Error('Permita o armazenamento e tente novamente.'),
  )
  vi.spyOn(repository, 'snapshot').mockResolvedValue(before)
  const close = vi.fn()
  render(<FlashcardForm onClose={close} />)
  expect(screen.getByLabelText('Pergunta')).toHaveFocus()
  fireEvent.change(screen.getByLabelText('Pergunta'), {
    target: { value: 'Pergunta' },
  })
  fireEvent.change(screen.getByLabelText('Resposta'), {
    target: { value: 'Resposta' },
  })
  await act(async () => {
    fireEvent.submit(
      screen.getByRole('button', { name: 'Salvar flashcard' }).closest('form')!,
    )
  })
  expect(screen.getByRole('alert')).toHaveTextContent('Permita o armazenamento')
  expect(screen.getByLabelText('Pergunta')).toHaveValue('Pergunta')
  expect(screen.getByLabelText('Resposta')).toHaveValue('Resposta')
  expect(close).not.toHaveBeenCalled()
})
it('formulário descartado não fecha outra tela após gravação tardia', async () => {
  let complete: (value: Snapshot) => void = () => {}
  const pending = new Promise<Snapshot>((resolve) => {
    complete = resolve
  })
  vi.spyOn(repository, 'saveFlashcard').mockReturnValue(pending)
  vi.spyOn(repository, 'canUndoFlashcard').mockResolvedValue(false)
  const close = vi.fn()
  const view = render(<FlashcardForm onClose={close} />)
  fireEvent.change(screen.getByLabelText('Pergunta'), {
    target: { value: 'Pergunta' },
  })
  fireEvent.change(screen.getByLabelText('Resposta'), {
    target: { value: 'Resposta' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: 'Salvar flashcard' }).closest('form')!,
  )
  view.unmount()
  await act(async () => {
    complete(useData.getState().data)
  })
  expect(close).not.toHaveBeenCalled()
})
