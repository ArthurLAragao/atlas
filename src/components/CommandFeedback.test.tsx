import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCommands } from '../app/command-store'
import { useData } from '../app/data-store'
import { buildSeed } from '../data/seed'
import { repository } from '../data/service'
import { CommandFeedback } from './CommandFeedback'

beforeEach(() => {
  useData.setState({
    data: buildSeed(),
    status: 'ready',
    busy: false,
    error: null,
    message: '',
  })
  useCommands.getState().closePalette()
  useCommands.setState({
    help: false,
    query: '',
    error: '',
    message: '',
    recoveryQuery: '',
  })
})

afterEach(() => vi.restoreAllMocks())

it('anuncia uma falha após fechar a captura e recupera o texto original ao tentar novamente', async () => {
  const before = useData.getState().data
  const query = 'nota: Resumo TCP #faculdade'
  let rejectSave: (error: Error) => void = () => {}
  vi.spyOn(repository, 'save').mockImplementation((_collection, item) => {
    expect(item).toMatchObject({ title: 'Resumo TCP' })
    return new Promise<typeof item>((_resolve, reject) => {
      rejectSave = reject
    })
  })
  render(<CommandFeedback />)
  let pending: Promise<boolean> = Promise.resolve(false)
  act(() => {
    useCommands.getState().openPalette(query)
    pending = useCommands.getState().capture()
    useCommands.getState().closePalette()
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(useData.getState().busy).toBe(true)
  await act(async () => {
    rejectSave(new DOMException('full', 'QuotaExceededError'))
    expect(await pending).toBe(false)
  })
  expect(screen.getByRole('alert')).toHaveTextContent(
    'armazenamento está cheio',
  )
  expect(useData.getState().data).toEqual(before)
  expect(useData.getState().busy).toBe(false)
  expect(useCommands.getState().palette).toBe(false)
  fireEvent.click(
    screen.getByRole('button', { name: 'Tentar captura novamente' }),
  )
  expect(useCommands.getState()).toMatchObject({
    palette: true,
    query,
    error: '',
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('permite dispensar o aviso e o texto de recuperação sem criar novos dados', () => {
  const before = useData.getState().data
  useCommands.setState({
    error: 'Não foi possível guardar. Tente novamente.',
    recoveryQuery: 'hábito: Leitura #pessoal',
  })
  render(<CommandFeedback />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Fechar aviso de captura' }),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(useCommands.getState()).toMatchObject({
    palette: false,
    error: '',
    message: '',
    recoveryQuery: '',
  })
  expect(useData.getState().data).toEqual(before)
})
