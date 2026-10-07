import { lazy, Suspense, useLayoutEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import * as Popover from '@radix-ui/react-popover'
import {
  CircleHelp,
  Timer,
  UserRound,
  MoreHorizontal,
  Settings2,
} from 'lucide-react'
import { navigation } from './navigation'
import { usePreferences } from './preferences-store'
import { AppStatus } from '../components/AppStatus'
import { Appearance } from '../components/Appearance'
import { DataPanel } from '../components/DataPanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CommandFeedback } from '../components/CommandFeedback'
import { SeekCapture } from '../components/SeekCapture'
import { Dock, DockItem, DockSeparator } from '../components/ui/dock'
import { useCommands, useCommandShortcuts } from './command-store'
import { useData } from './data-store'

const CommandPalette = lazy(() =>
  import('../components/CommandPalette').then((m) => ({
    default: m.CommandPalette,
  })),
)
const ShortcutHelp = lazy(() =>
  import('../components/ShortcutHelp').then((m) => ({
    default: m.ShortcutHelp,
  })),
)

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const entries = mobile ? navigation.slice(0, 3) : navigation
  return (
    <Dock
      label={mobile ? 'Navegação inferior' : 'Navegação principal'}
      className={mobile ? 'dock-mobile' : 'dock-desktop'}
    >
      {entries.map(({ path, label, icon: Icon }) => (
        <DockItem key={path} to={path} label={label}>
          <Icon aria-hidden="true" />
        </DockItem>
      ))}
      <DockSeparator />
      <DockItem to="/perfil" label="Meu perfil">
        <UserRound aria-hidden="true" />
      </DockItem>
      {mobile && (
        <Popover.Root>
          <Popover.Trigger className="dock-item" aria-label="Mais páginas">
            <MoreHorizontal aria-hidden="true" />
            <span className="dock-label">Mais</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="dock-more appearance-panel glass"
              side="top"
              sideOffset={12}
              collisionPadding={16}
              aria-label="Mais páginas"
            >
              {navigation.slice(3).map(({ path, label, icon: Icon }) => (
                <Popover.Close asChild key={path}>
                  <Link className="dock-more-link" to={path}>
                    <Icon aria-hidden="true" />
                    {label}
                  </Link>
                </Popover.Close>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </Dock>
  )
}

export function Shell() {
  const toolbar = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const root = document.documentElement
    const measure = () => {
      const height = toolbar.current?.getBoundingClientRect().height
      if (height)
        root.style.setProperty('--toolbar-measured-height', `${height}px`)
    }
    measure()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (toolbar.current) observer?.observe(toolbar.current)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--toolbar-measured-height')
    }
  }, [])
  const focusing = useData((s) =>
    s.data.focusSessions.some((session) => session.status === 'in-progress'),
  )
  const storageFailed = usePreferences((s) => s.storageFailed)
  const palette = useCommands((s) => s.palette)
  const help = useCommands((s) => s.help)
  const { pathname } = useLocation()
  useCommandShortcuts()
  const current =
    navigation.find((item) => item.path === pathname)?.label ??
    { '/foco': 'Foco', '/perfil': 'Perfil', '/preferencias': 'Preferências' }[
      pathname
    ] ??
    'Página não encontrada'
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <div className="workspace">
        <header ref={toolbar} className="toolbar glass">
          <div className="toolbar-leading">
            <Link className="brand" to="/" aria-label="Atlas - início">
              <img
                className="brand-mark"
                src="/icons/atlas.svg"
                width="32"
                height="32"
                alt=""
                aria-hidden="true"
              />
              <span>
                atlas<span className="brand-dot">.</span>
              </span>
            </Link>
            <span className="breadcrumb">
              Meu espaço <span aria-hidden="true">/</span>{' '}
              <strong>{current}</strong>
            </span>
          </div>
          <div className="toolbar-actions">
            <Link
              to="/foco"
              className="icon-button"
              aria-label={
                focusing ? 'Retomar sessão de foco' : 'Abrir modo Foco'
              }
              title={focusing ? 'Sessão em andamento' : 'Modo Foco'}
            >
              <Timer aria-hidden="true" />
            </Link>
            <SeekCapture />
            <DataPanel />
            <div className="appearance-group">
              <Appearance />
              <Link
                className="icon-button"
                to="/preferencias"
                aria-label="Preferências"
                title="Preferências"
              >
                <Settings2 aria-hidden="true" />
              </Link>
            </div>
            <button
              className="icon-button"
              aria-label="Atalhos de teclado"
              title="Atalhos de teclado (?)"
              aria-keyshortcuts="?"
              onClick={() => useCommands.getState().openHelp()}
            >
              <CircleHelp aria-hidden="true" />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <AppStatus />
          {!palette && !help && <CommandFeedback />}
          {storageFailed && (
            <p role="status" className="storage-notice">
              O navegador bloqueou o salvamento das preferências. Permita o
              armazenamento local para mantê-las ao reabrir.
            </p>
          )}
          <ErrorBoundary key={pathname}>
            <Suspense
              fallback={
                <p role="status" data-route-loading>
                  Abrindo seu espaço.
                </p>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="workspace-footer">
          <span>Atlas · Seu centro de comando pessoal</span>
        </footer>
      </div>
      <Navigation />
      <Navigation mobile />
      <div id="toast-viewport" className="toast-viewport" />
      <Suspense fallback={null}>
        {palette && <CommandPalette />}
        {help && <ShortcutHelp />}
      </Suspense>
    </div>
  )
}
