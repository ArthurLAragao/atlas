import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { useCommands } from '../../app/command-store'
import { PageHeader } from '../../components/PageHeader'
import { createSearchIndex, searchEntries } from '../../lib/search'
import { emptySnapshot } from '../../data/models'
import { useNotes } from './note-store'
import { NewNoteForm } from './NewNoteForm'
const NoteEditor = lazy(() =>
  import('./NoteEditor').then((m) => ({ default: m.NoteEditor })),
)
import { NoteList } from './NoteList'
import { NoteFeedback } from './NoteFeedback'
import { QuickNote } from './QuickNote'
import { MarkdownImportButton } from '../../components/MarkdownImportButton'
import '../../styles/notes.css'

export default function NotesPage() {
  const [params, setParams] = useSearchParams()
  const notes = useData((state) => state.data.notes)
  const busy = useData((state) => state.busy)
  const recovery = useNotes(
    (state) => state.canUndo && !state.message && !state.error,
  )
  const [creating, setCreating] = useState(false)
  const query = params.get('search') ?? ''
  const archived = params.get('view') === 'archived'
  const selected = notes.find((note) => note.id === params.get('note'))
  const index = useMemo(
    () => createSearchIndex({ ...emptySnapshot(), notes }),
    [notes],
  )
  const matches = useMemo(
    () => new Set(searchEntries(index, query, 10_000).map((entry) => entry.id)),
    [index, query],
  )
  const visible = notes
    .filter(
      (note) =>
        Boolean(note.archivedAt) === archived &&
        (!query.trim() || matches.has(note.id)),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.title.localeCompare(b.title, 'pt-BR'),
    )
  useEffect(() => {
    void useNotes.getState().refreshUndo()
  }, [])
  function updateQuery(search: string) {
    setParams(
      {
        ...(selected
          ? {
              note: selected.id,
              ...(params.get('edit') === '1' ? { edit: '1' } : {}),
            }
          : {}),
        ...(archived ? { view: 'archived' } : {}),
        ...(search ? { search } : {}),
      },
      { replace: true },
    )
  }
  return (
    <div className="notes-page" data-reading={Boolean(selected)}>
      <NoteFeedback />
      {selected ? (
        <div className="notes-workspace">
          <aside className="notes-collection" aria-label="Coleção de notas">
            <div className="section-heading">
              <h2>Suas notas</h2>
              <button className="button" onClick={() => setCreating(true)}>
                Nova nota
              </button>
            </div>
            <label className="task-field">
              Buscar na coleção
              <input
                type="search"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Título, conteúdo ou #tag"
              />
            </label>
            <NoteList notes={visible} />
            {!visible.length && (
              <p className="form-help">
                Nenhuma nota nesta busca. Experimente outra palavra.
              </p>
            )}
          </aside>
          <div className="notes-reading">
            <Suspense fallback={<p role="status">Abrindo nota.</p>}>
              <NoteEditor
                key={selected.id}
                note={selected}
                edit={params.get('edit') === '1'}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <>
          <PageHeader title="Notas" eyebrow="Ideias que se encontram">
            Anote agora. Conecte quando fizer sentido.
          </PageHeader>
          {params.get('note') && (
            <p role="status">
              Esta nota não está mais disponível. Você pode desfazer sua
              exclusão ou escolher outra nota.
            </p>
          )}
          <div className="notes-workspace notes-library">
            <section className="notes-collection" aria-label="Coleção de notas">
              <div className="note-actions">
                <MarkdownImportButton />
                <button
                  className="button"
                  onClick={() => {
                    useNotes.getState().dismiss()
                    setCreating(true)
                  }}
                >
                  Nova nota
                </button>
                <button
                  className="button"
                  onClick={() => useCommands.getState().openPalette('buscar ')}
                >
                  Buscar em todo o Atlas
                </button>
              </div>
              <QuickNote
                onCreated={(note) => setParams({ note: note.id, edit: '1' })}
              />
              <div className="note-filters note-form">
                <label>
                  Buscar notas
                  <input
                    type="search"
                    value={query}
                    placeholder="Título, conteúdo ou #tag"
                    onChange={(event) => updateQuery(event.target.value)}
                  />
                </label>
                <label>
                  Mostrar notas
                  <select
                    value={archived ? 'archived' : 'active'}
                    onChange={(event) =>
                      setParams({
                        ...(query ? { search: query } : {}),
                        ...(event.target.value === 'archived'
                          ? { view: 'archived' }
                          : {}),
                      })
                    }
                  >
                    <option value="active">Ativas</option>
                    <option value="archived">Arquivadas</option>
                  </select>
                </label>
              </div>
              <p className="form-help" role="status">
                {visible.length}{' '}
                {visible.length === 1 ? 'nota encontrada' : 'notas encontradas'}
              </p>
              {visible.length ? (
                <NoteList notes={visible} />
              ) : (
                <div className="note-empty">
                  <h2>
                    {query
                      ? 'Ainda não encontramos essa ideia.'
                      : archived
                        ? 'Nenhuma nota arquivada.'
                        : 'Uma ideia já é um começo.'}
                  </h2>
                  <p>
                    {query
                      ? 'Busque outra palavra ou crie uma nota com esse título.'
                      : archived
                        ? 'Arquive uma nota quando quiser tirá-la da lista principal.'
                        : 'Crie sua primeira nota. Pode ser uma frase, uma dúvida ou algo que você aprendeu.'}
                  </p>
                </div>
              )}
            </section>
            <section
              className="notes-reading note-reading-empty"
              aria-label="Seu espaço de escrita"
            >
              <span className="eyebrow">Abrir, anotar, conectar</span>
              <h2>Uma ideia por vez.</h2>
              <p>
                Escolha uma nota na coleção para ler ou continuar escrevendo.
                Use [[nome da nota]] para conectar o que você aprende.
              </p>
              <button className="button" onClick={() => setCreating(true)}>
                Começar uma anotação
              </button>
            </section>
          </div>
        </>
      )}
      {recovery && (
        <details className="note-maintenance">
          <summary>Última ação em notas</summary>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (await useNotes.getState().undo())
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>('[data-note-recovered]')
                    ?.focus(),
                )
            }}
          >
            Desfazer última ação em notas
          </button>
        </details>
      )}
      {creating && (
        <NewNoteForm
          initialTitle={query.startsWith('#') ? '' : query}
          onClose={() => setCreating(false)}
          onCreated={(note) => {
            setCreating(false)
            setParams({ note: note.id, edit: '1' })
          }}
        />
      )}
    </div>
  )
}
