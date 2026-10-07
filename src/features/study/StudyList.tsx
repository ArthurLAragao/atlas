import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Subject, StudyPath } from '../../data/models'
import { pathProgress } from '../../lib/study'
import type { StudyKind } from './StudyEditors'

function Row({
  item,
  kind,
  index,
}: {
  item: Subject | StudyPath
  kind: StudyKind
  index: number
}) {
  return (
    <div className="direction-row">
      <Link
        data-study-index={index}
        to={`/estudos?${kind === 'subjects' ? 'subject' : 'path'}=${encodeURIComponent(item.id)}`}
      >
        <strong>
          {'color' in item && (
            <span
              aria-hidden="true"
              className={`study-mark study-mark-${item.color}`}
            />
          )}
          {item.title}
        </strong>
        <span className="caption">
          {item.status === 'active'
            ? 'Ativa'
            : item.status === 'completed'
              ? 'Concluída'
              : 'Arquivada'}
          {item.isExample ? ' · Exemplo' : ''}
          {'steps' in item
            ? ` · ${pathProgress(item).done}/${item.steps.length} etapas`
            : item.semester
              ? ` · ${item.semester}`
              : ''}
        </span>
      </Link>
      {'steps' in item && (
        <span className="direction-number">{pathProgress(item).percent}%</span>
      )}
    </div>
  )
}
function VirtualStudy({
  items,
  kind,
}: {
  items: (Subject | StudyPath)[]
  kind: StudyKind
}) {
  const parent = useRef<HTMLDivElement>(null)
  const pending = useRef<number | null>(null)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 112,
    overscan: 5,
  })
  return (
    <>
      <p className="caption">Use ↑ e ↓, Home e End para percorrer a lista.</p>
      <div
        ref={parent}
        className="direction-virtual"
        role="list"
        aria-label={kind === 'subjects' ? 'Disciplinas' : 'Trilhas de estudo'}
        onKeyDown={(event) => {
          const element =
            event.target instanceof HTMLElement
              ? event.target.closest<HTMLElement>('[data-study-index]')
              : null
          if (!element) return
          const current = Number(element.dataset.studyIndex)
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : event.key === 'ArrowDown'
                  ? Math.min(items.length - 1, current + 1)
                  : event.key === 'ArrowUp'
                    ? Math.max(0, current - 1)
                    : null
          if (next === null) return
          event.preventDefault()
          pending.current = next
          virtual.scrollToIndex(next)
          requestAnimationFrame(() =>
            parent.current
              ?.querySelector<HTMLElement>(`[data-study-index="${next}"]`)
              ?.focus(),
          )
        }}
      >
        <div
          className="direction-virtual-space"
          style={{ height: virtual.getTotalSize() }}
        >
          {virtual.getVirtualItems().map((row) => (
            <div
              key={items[row.index]!.id}
              role="listitem"
              aria-posinset={row.index + 1}
              aria-setsize={items.length}
              className="direction-virtual-row"
              data-index={row.index}
              ref={(element) => {
                virtual.measureElement(element)
                if (element && row.index === pending.current) {
                  element.querySelector<HTMLElement>('a')?.focus()
                  pending.current = null
                }
              }}
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <Row item={items[row.index]!} kind={kind} index={row.index} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
export function StudyList({
  items,
  kind,
}: {
  items: (Subject | StudyPath)[]
  kind: StudyKind
}) {
  return items.length > 200 ? (
    <VirtualStudy items={items} kind={kind} />
  ) : (
    <ul className="direction-list">
      {items.map((item, index) => (
        <li key={item.id}>
          <Row item={item} kind={kind} index={index} />
        </li>
      ))}
    </ul>
  )
}
