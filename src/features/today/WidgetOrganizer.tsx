import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { usePreferences } from '../../app/preferences-store'
import {
  defaultWidgets,
  moveWidget,
  widgetNames,
  type WidgetId,
  type WidgetPreference,
} from '../../lib/widgets'
import '../../styles/preferences.css'

export function WidgetOrganizer() {
  const storageFailed = usePreferences((state) => state.storageFailed)
  const widgets = usePreferences((state) => state.preferences.widgets)
  const update = usePreferences((state) => state.update)
  const [message, setMessage] = useState('')
  const [previous, setPrevious] = useState<WidgetPreference[] | null>(null)
  const [dragging, setDragging] = useState<WidgetId | null>(null)
  const touch = useRef<{ id: WidgetId; y: number; moved: boolean } | null>(null)
  function save(next: WidgetPreference[], message: string, focus?: WidgetId) {
    setPrevious(widgets)
    update({ widgets: next })
    setMessage(message)
    if (focus)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-widget-title="${focus}"]`)
          ?.focus(),
      )
  }
  function move(id: WidgetId, target: number) {
    save(
      moveWidget(widgets, id, target),
      `${widgetNames[id]} movido para a posição ${target + 1}.`,
      id,
    )
  }
  return (
    <section className="widget-organizer" aria-label="Organização da tela Hoje">
      <p>
        Escolha o que aparece e a ordem de leitura. Arraste pela alça ou use os
        botões de mover.
      </p>
      <ol className="widget-options">
        {widgets.map((item, index) => (
          <li
            key={item.id}
            data-widget-row={item.id}
            data-dragging={dragging === item.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData('atlas/widget') as WidgetId
              if (widgets.some((item) => item.id === id)) move(id, index)
            }}
          >
            <button
              className="icon-button"
              aria-label={`Arrastar ${widgetNames[item.id]}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('atlas/widget', item.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onPointerDown={(event) => {
                // One pointer path for mouse, pen and touch avoids native drag
                // cancellation when the destination scrolls into view.
                if (event.button !== 0) return
                event.preventDefault()
                touch.current = { id: item.id, y: event.clientY, moved: false }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (
                  !touch.current ||
                  (!touch.current.moved &&
                    Math.abs(event.clientY - touch.current.y) < 8)
                )
                  return
                touch.current.moved = true
                setDragging(item.id)
                const container =
                  event.currentTarget.closest<HTMLElement>('.data-sheet')
                const edge = event.currentTarget.getBoundingClientRect().height
                const bounds = container?.getBoundingClientRect()
                const delta =
                  event.clientY < (bounds?.top ?? 0) + edge
                    ? -edge
                    : event.clientY >
                        (bounds?.bottom ?? window.innerHeight) - edge
                      ? edge
                      : 0
                if (delta) {
                  if (container) container.scrollBy(0, delta)
                  else window.scrollBy(0, delta)
                }
              }}
              onPointerUp={(event) => {
                const source = touch.current
                touch.current = null
                setDragging(null)
                if (!source || !source.moved) return
                const row = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>('[data-widget-row]')
                const target = widgets.findIndex(
                  (entry) => entry.id === row?.dataset.widgetRow,
                )
                if (target >= 0) move(source.id, target)
              }}
              onPointerCancel={() => {
                touch.current = null
                setDragging(null)
              }}
            >
              <GripVertical aria-hidden="true" />
            </button>
            <label className="widget-toggle">
              <input
                type="checkbox"
                checked={item.visible}
                onChange={(event) =>
                  save(
                    widgets.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, visible: event.target.checked }
                        : entry,
                    ),
                    `${widgetNames[item.id]} ${event.target.checked ? 'visível' : 'oculto'}.`,
                  )
                }
              />
              <span data-widget-title={item.id} tabIndex={-1}>
                {widgetNames[item.id]}
              </span>
            </label>
            <div className="widget-move">
              <button
                className="icon-button"
                disabled={index === 0}
                aria-label={`Mover ${widgetNames[item.id]} para cima`}
                onClick={() => move(item.id, index - 1)}
              >
                <ArrowUp aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                disabled={index === widgets.length - 1}
                aria-label={`Mover ${widgetNames[item.id]} para baixo`}
                onClick={() => move(item.id, index + 1)}
              >
                <ArrowDown aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="button-row">
        <button
          className="button"
          onClick={() =>
            save(defaultWidgets(), 'Organização padrão restaurada.')
          }
        >
          Restaurar organização padrão
        </button>
        {previous && (
          <button
            className="button"
            onClick={() => {
              update({ widgets: previous })
              setPrevious(null)
              setMessage('Organização anterior recuperada.')
            }}
          >
            Desfazer organização
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {storageFailed && (
        <p role="alert">
          O navegador bloqueou o salvamento. Permita armazenamento local para
          manter a organização após recarregar.
        </p>
      )}
    </section>
  )
}
