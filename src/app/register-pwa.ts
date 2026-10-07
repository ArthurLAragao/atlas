import { registerSW } from 'virtual:pwa-register'
import { connectPwaEvents, usePwa } from './pwa-store'
// Runs once from main, outside StrictMode. SW is disabled during development.
connectPwaEvents()
function register() {
  const update = registerSW({
    immediate: true,
    onNeedRefresh: () =>
      usePwa.setState({ updateReady: true, dismissed: false }),
    onOfflineReady: () => usePwa.setState({ ready: true }),
    onRegisteredSW: (_url, registration) => {
      usePwa.setState({
        registration: registration ?? null,
        ready: Boolean(registration?.active),
      })
      // Workbox marks clientsClaim only after successful precache installation.
      navigator.serviceWorker.ready
        .then(() => usePwa.setState({ ready: true }))
        .catch(() =>
          usePwa.setState({
            error:
              'Não foi possível preparar o uso offline. Reabra online para tentar novamente.',
          }),
        )
    },
    onRegisterError: () =>
      usePwa.setState({
        error:
          'Não foi possível preparar o uso offline. Permita service workers e reabra online.',
      }),
  })
  usePwa.setState({ update: () => update(true) })
}

if (import.meta.env.PROD) {
  // Precache must not compete with the first route on a slow connection.
  // Observe a real rendered view (including a recoverable startup error).
  let scheduled = false
  const observer = new MutationObserver(schedule)
  function schedule() {
    if (scheduled || !document.querySelector('main h1')) return
    scheduled = true
    observer.disconnect()
    requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === 'function')
        window.requestIdleCallback(register, { timeout: 1000 })
      else window.setTimeout(register, 0)
    })
  }
  observer.observe(document.documentElement, { childList: true, subtree: true })
  schedule()
}
