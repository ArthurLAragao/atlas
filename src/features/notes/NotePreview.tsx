import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Note } from '../../data/models'
import { useData } from '../../app/data-store'
import { EntrySheet } from '../../components/EntrySheet'
import { notePreviewExcerpt, previewPosition } from '../../lib/note-preview'
import { MarkdownPreview } from './MarkdownPreview'
import '../../styles/note-preview.css'

function Content({ note }: { note: Note }) {
  const notes = useData((s) => s.data.notes)
  const excerpt = notePreviewExcerpt(note.content)
  return (
    <>
      <div className="note-thumbnail" aria-hidden="true">
        <span>Atlas · Nota</span>
        <strong>{note.title}</strong>
        <p>{excerpt.replace(/[#*`>]/gu, '').slice(0, 180)}</p>
      </div>
      <h2>{note.title}</h2>
      <p className="form-help">
        {note.tags.map((t) => `#${t}`).join(' ')} · Atualizada em{' '}
        {new Date(note.updatedAt).toLocaleDateString('pt-BR')}
      </p>
      <MarkdownPreview content={excerpt} notes={notes} />
      {note.content.length > 1200 && (
        <p className="form-help">Recorte da nota. Abra para ler tudo.</p>
      )}
    </>
  )
}
export function NotePreview({
  note,
  point,
  closing,
  onClose,
}: {
  note: Note
  point?: { x: number; y: number }
  closing?: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!point || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const styles = getComputedStyle(document.documentElement)
    const position = previewPosition(
      point.x,
      point.y,
      rect.width,
      rect.height,
      innerWidth,
      innerHeight,
      parseFloat(styles.getPropertyValue('--preview-offset')),
      parseFloat(styles.getPropertyValue('--preview-gutter')),
    )
    ref.current.style.translate = `${position.x}px ${position.y}px`
  }, [point])
  return point ? (
    createPortal(
      <div
        className="note-hover-preview"
        ref={ref}
        data-closing={closing}
        aria-hidden="true"
        inert
      >
        <Content note={note} />
      </div>,
      document.body,
    )
  ) : (
    <EntrySheet
      title={`Prévia: ${note.title}`}
      description="Um recorte para encontrar a ideia, sem sair da lista."
      onClose={onClose}
    >
      <Content note={note} />
    </EntrySheet>
  )
}
