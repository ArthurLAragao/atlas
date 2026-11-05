import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LumenCaptureButton } from './LumenCaptureButton'
import { useNotes } from './note-store'
import { useTasks } from '../tasks/task-store'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('mantém falha de conexão visível sem alegar captura', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  render(<LumenCaptureButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Capturar vídeo' }))
  expect(screen.getByRole('button', { name: 'Capturar e resumir' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Conectar ao Lumen' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Lumen indisponível'))
})

it('prepara uma tarefa apenas após a ação explícita e preserva a referência', async () => {
  const capture = { id: 'c'.repeat(32), title: 'Fila FIFO', state: 'ready', message: 'Publicado',
    exercise: 'Implemente uma fila FIFO.', publication: 'published', notion_url: 'https://app.notion.com/p/' + 'd'.repeat(32) }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/health') ? { service: 'lumen-capture-v1', token: 'test-session' } : { captures: [capture] },
  ))))
  const save = vi.spyOn(useNotes.getState(), 'save').mockImplementation(async (note) => note)
  const saveTask = vi.spyOn(useTasks.getState(), 'save').mockResolvedValue(true)
  render(<LumenCaptureButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Capturar vídeo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Conectar ao Lumen' }))
  await screen.findByRole('link', { name: 'Abrir nota no Notion' })
  expect(save).not.toHaveBeenCalled()
  expect(saveTask).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Salvar referência e preparar tarefa' }))
  await screen.findByRole('heading', { name: 'Nova tarefa' })
  expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Praticar: Fila FIFO')
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    id: 'lumen-capture-' + capture.id, content: expect.stringContaining(capture.notion_url),
  }), null)
  expect(saveTask).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }))
  await waitFor(() => expect(saveTask).toHaveBeenCalledWith(expect.objectContaining({
    status: 'todo', links: [{ type: 'notes', id: 'lumen-capture-' + capture.id }],
  }), null))
})
