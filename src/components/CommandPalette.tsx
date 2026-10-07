import { useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import { CheckCheck, Grid2X2, NotebookPen, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { navigation } from '../app/navigation'
import { restoreCommandFocus, useCommands } from '../app/command-store'
import { useData } from '../app/data-store'
import { createCapturedEntity, parseCapture } from '../lib/capture'
import { formatTaskDate, taskPriorityLabels } from '../lib/tasks'
import {
  createSearchIndex,
  searchEntries,
  searchHref,
  searchLabels,
} from '../lib/search'
import '../styles/commands.css'

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function routeResults(query: string) {
  const text = normalized(query)
  const explicit = text.startsWith('/') || /^ir(?:\s|$)/u.test(text)
  const needle = text.replace(/^\/|^ir(?:\s+|$)/u, '').trim()
  const exactRoute = navigation.some(
    (route) => normalized(route.label) === text,
  )
  const routes = navigation.filter(
    (route) =>
      !text ||
      normalized(route.label).includes(needle) ||
      route.path.slice(1).includes(needle),
  )
  return { routes, navigationOnly: explicit || exactRoute }
}

export function CommandPalette() {
  const open = useCommands((state) => state.palette)
  return open ? <OpenPalette /> : null
}

function OpenPalette() {
  const query = useCommands((state) => state.query)
  const error = useCommands((state) => state.error)
  const busy = useData((state) => state.busy)
  const ready = useData((state) => state.status === 'ready')
  const data = useData((state) => state.data)
  const index = useMemo(() => createSearchIndex(data), [data])
  const searchOnly = /^buscar(?:\s|$)/iu.test(query.trim())
  const searchQuery = searchOnly
    ? query.trim().replace(/^buscar\s*/iu, '')
    : query
  const found = searchEntries(index, searchQuery)
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const skipRestore = useRef(false)
  const { routes, navigationOnly } = routeResults(query)
  const now = new Date()
  const parsed = parseCapture(query, now)
  const title = parsed.kind === 'task' ? parsed.parsed.title : parsed.title
  const captureRequested =
    Boolean(query.trim()) && !navigationOnly && !searchOnly
  let valid = false
  if (captureRequested) {
    try {
      createCapturedEntity(parsed, now, 'capture-preview')
      valid = true
    } catch {
      /* The input remains editable; validation guidance appears below. */
    }
  }
  const [selected, setSelected] = useState(() =>
    searchOnly && found[0]
      ? `result:${found[0].id}`
      : captureRequested && valid
        ? 'capture'
        : routes[0]
          ? `route:${routes[0].path}`
          : '',
  )
  const kindLabel =
    parsed.kind === 'task'
      ? 'tarefa'
      : parsed.kind === 'note'
        ? 'nota'
        : 'hábito'
  const Icon =
    parsed.kind === 'task'
      ? CheckCheck
      : parsed.kind === 'note'
        ? NotebookPen
        : Grid2X2

  function changeQuery(value: string) {
    useCommands.getState().setQuery(value)
    const results = routeResults(value)
    setSelected(
      /^buscar(?:\s|$)/iu.test(value.trim())
        ? `result:${searchEntries(index, value.trim().replace(/^buscar\s*/iu, ''))[0]?.id ?? ''}`
        : value.trim() && !results.navigationOnly
          ? 'capture'
          : results.routes[0]
            ? `route:${results.routes[0].path}`
            : '',
    )
  }

  async function capture() {
    if (parsed.kind === 'note') skipRestore.current = true
    const ok = await useCommands.getState().capture()
    if (!ok) {
      skipRestore.current = false
      if (!useCommands.getState().palette) restoreCommandFocus()
      return
    }
    const noteId = useCommands.getState().noteToOpen
    if (noteId) navigate(`/notas?note=${encodeURIComponent(noteId)}&edit=1`)
    else if (parsed.kind === 'note' && !useCommands.getState().palette)
      restoreCommandFocus()
  }

  function go(path: string) {
    skipRestore.current = true
    useCommands.getState().closePalette()
    navigate(path)
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLHeadingElement>('main h1')
        ?.focus({ preventScroll: true }),
    )
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) useCommands.getState().closePalette()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="data-sheet command-palette glass"
          data-command-dialog
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            input.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (!skipRestore.current) restoreCommandFocus()
          }}
        >
          <header className="command-header">
            <div>
              <Dialog.Title>Captura rápida</Dialog.Title>
              <Dialog.Description>
                Digite, confira e pressione Enter. Tudo fica neste navegador.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Fechar captura rápida"
            >
              <X aria-hidden="true" />
            </Dialog.Close>
          </header>
          <Command
            label="Capturar ou navegar"
            shouldFilter={false}
            value={selected}
            onValueChange={setSelected}
            vimBindings={false}
            loop
          >
            <div className="command-input-line">
              <Search aria-hidden="true" />
              <Command.Input
                ref={input}
                aria-label="Capturar ou navegar"
                value={query}
                onValueChange={changeQuery}
                disabled={busy}
                maxLength={5000}
                placeholder="Tarefa, nota: ideia ou buscar conteúdo."
              />
            </div>
            <Command.List
              className="command-list"
              label="Ações disponíveis"
              aria-busy={busy}
            >
              {captureRequested && (
                <Command.Group heading="Capturar">
                  <Command.Item
                    value="capture"
                    disabled={!valid || busy || !ready}
                    onSelect={() => void capture()}
                    className="command-item command-capture-item"
                  >
                    <Icon aria-hidden="true" />
                    <div>
                      <strong>Criar {kindLabel}</strong>
                      <span>
                        {title || `Digite um nome após ${kindLabel}:`}
                      </span>
                    </div>
                    <span className="command-enter" aria-hidden="true">
                      Enter
                    </span>
                  </Command.Item>
                </Command.Group>
              )}
              {found.length > 0 && (
                <Command.Group heading="Seus registros">
                  {found.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={`result:${entry.id}`}
                      onSelect={() => go(searchHref(entry))}
                      className="command-item command-capture-item"
                    >
                      <Search aria-hidden="true" />
                      <div>
                        <strong>{entry.title}</strong>
                        <span>
                          {searchLabels[entry.type]}
                          {entry.archived ? ' · Arquivada' : ''} ·{' '}
                          {entry.tags.map((tag) => `#${tag}`).join(' ')}
                        </span>
                        {entry.preview && <span>{entry.preview}</span>}
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {searchOnly && !found.length && (
                <p className="command-empty">
                  {searchQuery
                    ? 'Nenhum registro encontrado. Tente outra palavra ou #tag.'
                    : 'Digite uma palavra do título ou do conteúdo para buscar em todo o Atlas.'}
                </p>
              )}
              {!searchOnly && routes.length > 0 && (
                <Command.Group heading="Navegar">
                  {routes.map((route) => (
                    <Command.Item
                      key={route.path}
                      value={`route:${route.path}`}
                      onSelect={() => go(route.path)}
                      className="command-item"
                    >
                      <route.icon aria-hidden="true" />
                      <span>Ir para {route.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {navigationOnly && routes.length === 0 && (
                <p className="command-empty">
                  Nenhuma tela encontrada. Tente ir hoje ou ir tarefas.
                </p>
              )}
            </Command.List>
          </Command>
          {captureRequested && (
            <section
              className="command-preview"
              aria-label="Interpretação da captura"
            >
              {parsed.kind === 'task' ? (
                <>
                  <p>
                    {parsed.parsed.dueDate
                      ? formatTaskDate(parsed.parsed.dueDate)
                      : 'Sem prazo'}
                    {parsed.parsed.dueTime ? ` · ${parsed.parsed.dueTime}` : ''}{' '}
                    · Prioridade{' '}
                    {taskPriorityLabels[
                      parsed.parsed.priority
                    ].toLocaleLowerCase('pt-BR')}
                  </p>
                  {parsed.parsed.tags.length > 0 && (
                    <p>
                      {parsed.parsed.tags.map((tag) => `#${tag}`).join(' ')}
                    </p>
                  )}
                  {parsed.parsed.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </>
              ) : (
                <>
                  <p>
                    {parsed.kind === 'note'
                      ? 'Cria uma nota e abre o editor para continuar escrevendo.'
                      : 'Hábito simples, todos os dias. Edite a frequência e os detalhes em Hábitos.'}
                  </p>
                  {parsed.tags.length > 0 && (
                    <p>{parsed.tags.map((tag) => `#${tag}`).join(' ')}</p>
                  )}
                </>
              )}
              {!valid && (
                <p>
                  Use um nome de 1 a 240 caracteres e até 50 tags de 60
                  caracteres. Em notas, evite [[ e ]].
                </p>
              )}
            </section>
          )}
          {!query.trim() && (
            <p className="command-examples">
              estudar AWS amanhã 19h #faculdade !alta
              <br />
              nota: ideia de projeto
              <br />
              hábito: leitura
            </p>
          )}
          {error && (
            <p className="command-error" role="alert">
              {error}
            </p>
          )}
          <footer className="command-footer">
            <span>Setas escolher · Enter confirmar · Esc fechar</span>
            <span>ir hoje navega · buscar palavra encontra conteúdo</span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
