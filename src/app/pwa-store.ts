import { create } from 'zustand'
interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
interface PwaState {
  offline: boolean
  ready: boolean
  updateReady: boolean
  dismissed: boolean
  error: string
  registration: ServiceWorkerRegistration | null
  installPrompt: InstallPrompt | null
  installed: boolean
  update: (() => Promise<void>) | null
}
export const usePwa = create<PwaState>(() => ({
  offline: !navigator.onLine,
  ready: false,
  updateReady: false,
  dismissed: false,
  error: '',
  registration: null,
  installPrompt: null,
  installed: window.matchMedia('(display-mode: standalone)').matches,
  update: null,
}))
export function connectPwaEvents(): () => void {
  const online = () => {
    usePwa.setState({ offline: false })
    void checkForUpdate()
  }
  const offline = () => usePwa.setState({ offline: true })
  const visible = () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  }
  const install = (event: Event) => {
    if (
      'prompt' in event &&
      typeof event.prompt === 'function' &&
      'userChoice' in event
    ) {
      event.preventDefault()
      usePwa.setState({ installPrompt: event as InstallPrompt })
    }
  }
  const installed = () =>
    usePwa.setState({ installed: true, installPrompt: null })
  window.addEventListener('online', online)
  window.addEventListener('offline', offline)
  window.addEventListener('beforeinstallprompt', install)
  window.addEventListener('appinstalled', installed)
  document.addEventListener('visibilitychange', visible)
  const interval = window.setInterval(
    () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    },
    60 * 60 * 1000,
  )
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('online', online)
    window.removeEventListener('offline', offline)
    window.removeEventListener('beforeinstallprompt', install)
    window.removeEventListener('appinstalled', installed)
    document.removeEventListener('visibilitychange', visible)
  }
}
export async function checkForUpdate() {
  if (!navigator.onLine) return
  try {
    await usePwa.getState().registration?.update()
    usePwa.setState({ error: '' })
  } catch {
    usePwa.setState({
      error:
        'Não foi possível conferir a atualização. Reconecte e tente novamente.',
    })
  }
}
