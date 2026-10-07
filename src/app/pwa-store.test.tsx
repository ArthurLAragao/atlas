import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { connectPwaEvents, usePwa } from './pwa-store'
import { AppStatus } from '../components/AppStatus'
import { InstallApp } from '../features/preferences/InstallApp'
const initial = usePwa.getState()
beforeEach(() => usePwa.setState(initial))
afterEach(() => vi.restoreAllMocks())
it('verificação explícita reabre aviso adiado e fica desabilitada offline', async () => {
  const user = userEvent.setup()
  const update = vi.fn().mockResolvedValue(undefined)
  usePwa.setState({
    updateReady: true,
    dismissed: true,
    registration: { update } as unknown as ServiceWorkerRegistration,
    offline: false,
  })
  render(
    <>
      <AppStatus />
      <InstallApp />
    </>,
  )
  expect(
    screen.queryByRole('button', { name: /^Atualizar$/ }),
  ).not.toBeInTheDocument()
  await user.click(
    screen.getByRole('button', { name: 'Verificar atualização' }),
  )
  expect(update).toHaveBeenCalledTimes(1)
  expect(
    screen.getByRole('button', { name: /^Atualizar$/ }),
  ).toBeInTheDocument()
  act(() => usePwa.setState({ offline: true }))
  expect(
    screen.getByRole('button', { name: 'Verificar atualização' }),
  ).toBeDisabled()
})
it('observa rede sem alarme e remove listeners ao desligar', () => {
  const stop = connectPwaEvents()
  window.dispatchEvent(new Event('offline'))
  expect(usePwa.getState().offline).toBe(true)
  window.dispatchEvent(new Event('online'))
  expect(usePwa.getState().offline).toBe(false)
  stop()
  window.dispatchEvent(new Event('offline'))
  expect(usePwa.getState().offline).toBe(false)
})
it('só oferece instalação em resposta ao evento do navegador, sem solicitar permissões', () => {
  const stop = connectPwaEvents()
  const event = Object.assign(
    new Event('beforeinstallprompt', { cancelable: true }),
    {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    },
  )
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(event.prompt).not.toHaveBeenCalled()
  expect(usePwa.getState().installPrompt).toBe(event)
  window.dispatchEvent(new Event('appinstalled'))
  expect(usePwa.getState().installed).toBe(true)
  expect(usePwa.getState().installPrompt).toBeNull()
  stop()
})
it('atualização exige ação explícita, pode ser adiada e preserva estado em falha', async () => {
  const user = userEvent.setup(),
    update = vi.fn().mockRejectedValue(new Error('offline'))
  usePwa.setState({ updateReady: true, update, offline: false })
  render(<AppStatus />)
  expect(update).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: /^Atualizar$/ }))
  expect(update).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/A atualização não foi aplicada/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Agora não' }))
  expect(
    screen.queryByRole('button', { name: 'Atualizar' }),
  ).not.toBeInTheDocument()
  expect(usePwa.getState().updateReady).toBe(true)
})
