import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Note } from '../../data/models'
import '../../styles/note-preview.css'

const NotePreview = lazy(() =>
  import('./NotePreview').then((m) => ({ default: m.NotePreview })),
)

function NoteRow({ note }: { note: Note }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [explicit, setExplicit] = useState(false)
  const [closing, setClosing] = useState(false)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exit = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursor = useRef({ x: 0, y: 0 })
  const frame = useRef<number | null>(null)
  function cancel(immediate = false) {
    if (pending.current) clearTimeout(pending.current)
    if (exit.current) clearTimeout(exit.current)
    if (frame.current) cancelAnimationFrame(frame.current)
    if (immediate) {
      setPoint(null)
      setClosing(false)
    } else {
      setClosing(true)
      exit.current = setTimeout(() => {
        setPoint(null)
        setClosing(false)
      }, 180)
    }
  }
  useEffect(() => {
    const hide = () => {
      if (pending.current) clearTimeout(pending.current)
      if (exit.current) clearTimeout(exit.current)
      setPoint(null)
      setClosing(false)
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('wheel', hide, { passive: true })
    window.addEventListener('resize', hide)
    document.addEventListener('selectionchange', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('wheel', hide)
      window.removeEventListener('resize', hide)
      document.removeEventListener('selectionchange', hide)
      if (pending.current) clearTimeout(pending.current)
      if (exit.current) clearTimeout(exit.current)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])
  return (
    <div
      className="note-row-group"
      onPointerEnter={(e) => {
        if (
          e.pointerType !== 'mouse' ||
          !matchMedia('(hover: hover) and (pointer: fine)').matches ||
          e.buttons ||
          window.getSelection()?.toString()
        )
          return
        cursor.current = { x: e.clientX, y: e.clientY }
        if (pending.current) clearTimeout(pending.current)
        if (exit.current) clearTimeout(exit.current)
        pending.current = setTimeout(() => {
          setClosing(false)
          setPoint({ ...cursor.current })
        }, 600)
      }}
      onPointerMove={(e) => {
        if (e.buttons || window.getSelection()?.toString()) {
          cancel(true)
          return
        }
        cursor.current = { x: e.clientX, y: e.clientY }
        if (point && !frame.current)
          frame.current = requestAnimationFrame(() => {
            setPoint({ ...cursor.current })
            frame.current = null
          })
      }}
      onPointerLeave={() => cancel()}
      onDragStart={() => cancel(true)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel(true)
      }}
    >
      <Link className="note-row" to={`/notas?note=${note.id}&edit=1`}>
        <strong>{note.title}</strong>
        <span className="note-excerpt">
          {note.content.replace(/\s+/gu, ' ').slice(0, 150) ||
            'Abra para começar a escrever.'}
        </span>
        <span className="form-help">
          {note.tags.map((tag) => `#${tag}`).join(' ')}
          {note.isExample ? ' · Exemplo' : ''}
          {note.archivedAt ? ' · Arquivada' : ''}
        </span>
      </Link>
      <button
        className="button note-peek-button"
        aria-label={`Mostrar prévia de ${note.title}`}
        onClick={() => {
          cancel(true)
          setExplicit(true)
        }}
      >
        Prévia
      </button>
      <Suspense fallback={null}>
        {(point || explicit) && (
          <NotePreview
            note={note}
            point={explicit ? undefined : (point ?? undefined)}
            closing={closing}
            onClose={() => setExplicit(false)}
          />
        )}
      </Suspense>
    </div>
  )
}
export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length > 200) return <VirtualNotes notes={notes} />
  return (
    <ul className="note-list" aria-label="Notas encontradas">
      {notes.map((note) => (
        <li key={note.id}>
          <NoteRow note={note} />
        </li>
      ))}
    </ul>
  )
}
function VirtualNotes({ notes }: { notes: Note[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const pending = useRef<number | null>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: notes.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 144,
    overscan: 5,
  })
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (!['Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-note-index]',
    )
    if (!current) return
    event.preventDefault()
    const index = Number(current.dataset.noteIndex)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? notes.length - 1
          : Math.max(
              0,
              Math.min(
                notes.length - 1,
                index + (event.key === 'ArrowDown' ? 1 : -1),
              ),
            )
    pending.current = next
    virtual.scrollToIndex(next, { align: 'auto' })
    requestAnimationFrame(() => {
      const link = scroller.current?.querySelector<HTMLElement>(
        `[data-note-index="${next}"] a`,
      )
      if (link) {
        link.focus()
        pending.current = null
      }
    })
  }
  return (
    <>
      <p className="form-help">
        Lista longa: setas percorrem as notas; Home/End alcançam os extremos.
      </p>
      <div className="note-list-scroll" ref={scroller} onKeyDown={move}>
        <div
          className="note-virtual-space"
          role="list"
          aria-label="Notas encontradas"
          style={{ height: virtual.getTotalSize() }}
        >
          {virtual.getVirtualItems().map((item) => (
            <div
              key={notes[item.index]!.id}
              role="listitem"
              aria-setsize={notes.length}
              aria-posinset={item.index + 1}
              data-index={item.index}
              data-note-index={item.index}
              className="note-virtual-row"
              style={{ transform: `translateY(${item.start}px)` }}
              ref={(node) => {
                virtual.measureElement(node)
                if (node && pending.current === item.index) {
                  node.querySelector('a')?.focus()
                  pending.current = null
                }
              }}
            >
              <NoteRow note={notes[item.index]!} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
