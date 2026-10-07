import { ConfirmAction } from '../../components/ConfirmAction'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Note } from '../../data/models'
import { noteSchema } from '../../data/models'
import { PageHeader } from '../../components/PageHeader'
import { useData } from '../../app/data-store'
import {
  backlinks,
  noteKey,
  parseWikiLinks,
  resolveNote,
} from '../../lib/note-links'
import { exportNoteMarkdown } from '../../lib/note-markdown'
import { readNoteTags } from '../../lib/note-tags'
import { useDrafts } from './draft-store'
import { useNotes } from './note-store'
import { NoteComposer } from './NoteComposer'

const MarkdownPreview = lazy(() =>
  import('./MarkdownPreview').then((module) => ({
    default: module.MarkdownPreview,
  })),
)

export function NoteEditor({ note, edit }: { note: Note; edit: boolean }) {
  const navigate = useNavigate()
  const notes = useData((state) => state.data.notes)
  const busy = useData((state) => state.busy)
  const stored = useDrafts((state) => state.drafts[note.id])
  const draftError = useDrafts((state) => state.error)
  const draft = stored ?? {
    title: note.title,
    content: note.content,
    tags: note.tags.join(', '),
    originalTags: note.tags,
    basedOn: note.updatedAt,
  }
  const [mode, setMode] = useState<'edit' | 'preview'>(
    edit && !note.archivedAt ? 'edit' : 'preview',
  )
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const incoming = useMemo(() => backlinks(note.id, notes), [note.id, notes])
  const unresolved = useMemo(
    () => [
      ...new Set(
        parseWikiLinks(draft.content)
          .filter((link) => !resolveNote(link.title, notes))
          .map((link) => link.title),
      ),
    ],
    [draft.content, notes],
  )
  const duplicate = notes.some(
    (item) =>
      item.id !== note.id && noteKey(item.title) === noteKey(draft.title),
  )
  const dirty = Boolean(stored)
  function change(update: Partial<typeof draft>) {
    useDrafts.getState().put(note.id, { ...draft, ...update })
    setValidation('')
    setNotice('')
  }
  async function save(copy = false) {
    const now = new Date().toISOString()
    const result = noteSchema.safeParse({
      ...note,
      title: copy ? `${draft.title.slice(0, 230)} (cópia)` : draft.title,
      content: draft.content,
      tags: readNoteTags(draft.tags, draft.originalTags ?? note.tags),
      ...(copy
        ? {
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          }
        : {}),
    })
    if (!result.success) {
      setValidation(
        'Use um título de até 240 caracteres e no máximo 50 tags de 60 caracteres.',
      )
      return
    }
    const saved = await useNotes
      .getState()
      .save(result.data, copy ? null : draft.basedOn)
    if (saved) {
      useDrafts.getState().clear(note.id)
      setNotice('Nota salva.')
      if (copy) navigate(`/notas?note=${saved.id}&edit=1`)
    }
  }
  useEffect(() => {
    if (mode === 'edit' && !note.archivedAt) {
      const frame = requestAnimationFrame(() =>
        document.querySelector<HTMLTextAreaElement>('.note-textarea')?.focus(),
      )
      return () => cancelAnimationFrame(frame)
    }
  }, [mode, note.archivedAt])
  useEffect(() => {
    if (!dirty || !draftError) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty, draftError])
  function download() {
    const text = exportNoteMarkdown({
      ...note,
      title: draft.title || note.title,
      content: draft.content,
      tags: readNoteTags(draft.tags, draft.originalTags ?? note.tags),
    })
    const url = URL.createObjectURL(
      new Blob([text], { type: 'text/markdown;charset=utf-8' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(draft.title || 'nota').replace(/[<>:"/\\|?*]/gu, '-').slice(0, 100)}.md`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    setNotice('Markdown preparado. Confira os downloads do navegador.')
  }
  async function archive() {
    if (await useNotes.getState().archive(note.id, !note.archivedAt))
      navigate(`/notas?view=${note.archivedAt ? 'active' : 'archived'}`)
  }
  async function remove() {
    if (await useNotes.getState().remove(note.id)) {
      useDrafts.getState().clear(note.id)
      navigate('/notas')
    }
  }
  return (
    <div
      className="note-editor"
      onKeyDown={(event) => {
        if (
          event.ctrlKey !== event.metaKey &&
          event.key.toLowerCase() === 's' &&
          !event.altKey &&
          !event.shiftKey &&
          !event.repeat &&
          !event.defaultPrevented &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault()
          if (!busy && !note.archivedAt) void save()
        }
      }}
    >
      <Link className="note-back button" to="/notas">
        Voltar às notas
      </Link>
      <PageHeader
        title={note.title}
        eyebrow={
          note.archivedAt ? 'Nota arquivada' : 'Seu conhecimento, conectado'
        }
      >
        {note.isExample
          ? 'Exemplo — edite para tornar esta nota sua.'
          : 'Um espaço para desenvolver e conectar suas ideias.'}
      </PageHeader>
      <div className="note-actions">
        <div className="note-modes" role="group" aria-label="Exibição da nota">
          <button
            className="button"
            aria-pressed={mode === 'edit'}
            onClick={() => setMode('edit')}
            disabled={Boolean(note.archivedAt)}
          >
            Editar
          </button>
          <button
            className="button"
            aria-pressed={mode === 'preview'}
            onClick={() => setMode('preview')}
          >
            Pré-visualizar
          </button>
        </div>
        <button
          className="button button-primary"
          disabled={busy || !dirty || Boolean(note.archivedAt)}
          onClick={() => void save()}
        >
          Salvar nota
        </button>
        <button className="button" onClick={download}>
          Exportar Markdown
        </button>
      </div>
      <p className="note-save-status" role="status">
        {notice ||
          (dirty
            ? draftError
              ? 'Rascunho só nesta aba: salve ou exporte antes de fechar.'
              : 'Rascunho guardado neste navegador. Salve para atualizar vínculos e busca.'
            : 'Todas as alterações estão salvas.')}
      </p>
      {validation && (
        <p role="alert" className="data-error">
          {validation}
        </p>
      )}
      {dirty && draft.basedOn !== note.updatedAt && (
        <p className="data-error" role="alert">
          A versão salva mudou em outra aba. Seu rascunho foi preservado.{' '}
          <button
            className="button"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Salvar rascunho como cópia
          </button>
        </p>
      )}
      {duplicate && (
        <p className="form-help">
          Há outra nota com este título. Diferencie os nomes para resolver
          [[links]] sem ambiguidade.
        </p>
      )}
      {mode === 'edit' ? (
        <div className="note-form">
          <label>
            Título da nota
            <input
              value={draft.title}
              maxLength={240}
              disabled={busy}
              onChange={(event) => change({ title: event.target.value })}
            />
          </label>
          <label>
            Tags da nota
            <input
              value={draft.tags}
              maxLength={4000}
              disabled={busy}
              onChange={(event) => change({ tags: event.target.value })}
              placeholder="faculdade, cloud"
            />
          </label>
          <NoteComposer
            content={draft.content}
            onChange={(content) => change({ content })}
            notes={notes}
            disabled={busy}
          />
        </div>
      ) : (
        <Suspense fallback={<p role="status">Preparando a prévia.</p>}>
          <MarkdownPreview content={draft.content} notes={notes} />
        </Suspense>
      )}
      {unresolved.length > 0 && (
        <details className="note-connections">
          <summary>Links a resolver ({unresolved.length})</summary>
          <p className="form-help">
            Crie a nota com esse nome ou diferencie títulos repetidos.
          </p>
          <ul>
            {unresolved.map((title) => (
              <li key={title}>
                <Link to={`/notas?search=${encodeURIComponent(title)}`}>
                  {title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <section className="note-connections" aria-labelledby="backlink-heading">
        <h2 id="backlink-heading">Notas que apontam para cá</h2>
        {incoming.length ? (
          <ul>
            {incoming.map((item) => (
              <li key={item.id}>
                <Link to={`/notas?note=${item.id}`}>{item.title}</Link>
                {item.archivedAt && (
                  <span className="form-help"> · Arquivada</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-help">
            Use [[{note.title}]] em outra nota para conectá-las.
          </p>
        )}
      </section>
      <div className="note-actions note-maintenance">
        <button
          className="button"
          disabled={busy || dirty}
          onClick={() => void archive()}
        >
          {note.archivedAt ? 'Desarquivar nota' : 'Arquivar nota'}
        </button>
        <ConfirmAction
          name={note.title}
          title="Excluir esta nota?"
          description="Esta ação remove a nota. Você poderá desfazer e restaurar seus vínculos."
          className="button"
          disabled={busy || dirty}
          onConfirm={() => void remove()}
        >
          Excluir nota
        </ConfirmAction>
        {dirty && (
          <span className="form-help">
            Salve o rascunho antes de arquivar ou excluir.
          </span>
        )}
      </div>
    </div>
  )
}
