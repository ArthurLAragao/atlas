import { useRef, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link } from 'react-router-dom'
import type { Goal, Project } from '../../data/models'
import {
  directionHref,
  goalProgress,
  goalStatus,
  goalStatusLabels,
  projectStatus,
  projectStatusLabels,
} from '../../lib/goals'

type Direction = Goal | Project
function DirectionRow({ item, index }: { item: Direction; index: number }) {
  const goal = 'keyResults' in item ? item : undefined
  return (
    <div className="direction-row">
      <Link
        data-direction-index={index}
        to={directionHref(goal ? 'goals' : 'projects', item.id)}
      >
        <strong>{item.title}</strong>
        <span className="caption">
          {goal
            ? goalStatusLabels[goalStatus(goal)]
            : projectStatusLabels[projectStatus(item as Project)]}
          {item.isExample ? ' · Exemplo' : ''}
          {goal?.weekly ? ' · Meta da semana' : ''}
        </span>
      </Link>
      {goal && (
        <div className="direction-mini-progress">
          <span className="caption">{goalProgress(goal).percent}%</span>
          <progress
            aria-label={`Progresso de ${goal.title}`}
            max={100}
            value={goalProgress(goal).percent}
          />
        </div>
      )}
    </div>
  )
}
function VirtualDirections({
  items,
  label,
}: {
  items: Direction[]
  label: string
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
  function keyboard(event: KeyboardEvent) {
    const active =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-direction-index]')
        : null
    if (!active) return
    const current = Number(active.dataset.directionIndex)
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
    virtual.scrollToIndex(next, { align: 'auto' })
    requestAnimationFrame(() =>
      parent.current
        ?.querySelector<HTMLElement>(`[data-direction-index="${next}"]`)
        ?.focus(),
    )
  }
  return (
    <>
      <p className="caption">Use ↑ e ↓, Home e End para percorrer a lista.</p>
      <div
        ref={parent}
        className="direction-virtual"
        role="list"
        aria-label={label}
        onKeyDown={keyboard}
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
              data-index={row.index}
              ref={(element) => {
                virtual.measureElement(element)
                if (element && row.index === pending.current) {
                  element.querySelector<HTMLElement>('a')?.focus()
                  pending.current = null
                }
              }}
              className="direction-virtual-row"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <DirectionRow item={items[row.index]!} index={row.index} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
export function DirectionList({
  items,
  label,
}: {
  items: Direction[]
  label: string
}) {
  return items.length > 200 ? (
    <VirtualDirections items={items} label={label} />
  ) : (
    <ul className="direction-list" aria-label={label}>
      {items.map((item, index) => (
        <li key={item.id}>
          <DirectionRow item={item} index={index} />
        </li>
      ))}
    </ul>
  )
}
