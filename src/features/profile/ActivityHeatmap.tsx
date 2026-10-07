import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { ActivityEvent } from '../../data/profile-models'
import { activityGrid, activityLabels } from '../../lib/activity'
import { formatDay } from '../../lib/habits'

export function ActivityHeatmap({
  events,
  today,
}: {
  events: ActivityEvent[]
  today: string
}) {
  const [weeks, setWeeks] = useState(13),
    [text, setText] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(today)
  const grid = useMemo(
    () => activityGrid(events, today, weeks),
    [events, today, weeks],
  )
  const days = grid.flat().filter((d) => !d.future),
    buttons = useRef(new Map<string, HTMLButtonElement>())
  const scroll = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth
  }, [weeks, text])
  function description(day: (typeof days)[number]) {
    return `${formatDay(day.date)} · ${day.points} ${day.points === 1 ? 'ação' : 'ações'}${Object.entries(
      day.types,
    )
      .map(
        ([kind, n]) =>
          ` · ${activityLabels[kind as ActivityEvent['kind']]}: ${n}`,
      )
      .join('')}`
  }
  function move(e: KeyboardEvent, date: string) {
    const i = days.findIndex((d) => d.date === date)
    const offsets: Record<string, number> = {
      ArrowLeft: -7,
      ArrowRight: 7,
      ArrowUp: -1,
      ArrowDown: 1,
      Home: -(i % 7),
      End: 6 - (i % 7),
    }
    if (!(e.key in offsets)) return
    e.preventDefault()
    const day =
      days[Math.max(0, Math.min(days.length - 1, i + offsets[e.key]!))]
    if (day) {
      setSelected(day.date)
      buttons.current.get(day.date)?.focus()
      buttons.current
        .get(day.date)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }
  return (
    <section className="profile-section" aria-labelledby="activity-title">
      <div className="section-heading">
        <div>
          <h2 id="activity-title">Atividade no Atlas</h2>
          <p className="form-help">
            Ações registradas, além dos hábitos. Cada ação vale um ponto de
            atividade.
          </p>
        </div>
        <label className="task-field">
          Período
          <select
            aria-label="Período"
            value={weeks}
            onChange={(e) => {
              setWeeks(Number(e.target.value))
              setPage(0)
            }}
          >
            {[13, 26, 52].map((n) => (
              <option key={n} value={n}>
                {n} semanas
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="button-row">
        <button
          className="button"
          aria-pressed={text}
          onClick={() => setText(!text)}
        >
          {text ? 'Ver gráfico' : 'Ver em texto'}
        </button>
        <span className="form-help">
          Setas percorrem os dias. Sem atividade, 1, 2–3, 4–6 e 7+ ações.
        </span>
      </div>
      {text ? (
        <>
          <ul className="activity-text">
            {[...days]
              .reverse()
              .slice(page * 28, (page + 1) * 28)
              .map((day) => (
                <li key={day.date}>{description(day)}</li>
              ))}
          </ul>
          <div className="button-row">
            <button
              className="button"
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Recentes
            </button>
            <span>
              Página {page + 1} de {Math.ceil(days.length / 28)}
            </span>
            <button
              className="button"
              disabled={(page + 1) * 28 >= days.length}
              onClick={() => setPage(page + 1)}
            >
              Anteriores
            </button>
          </div>
        </>
      ) : (
        <Tooltip.Provider delayDuration={250}>
          <div className="heatmap-scroll" ref={scroll}>
            <div
              className="heatmap-grid"
              role="grid"
              aria-label="Atividade diária no Atlas"
              aria-rowcount={7}
              aria-colcount={weeks}
            >
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(
                (label, row) => (
                  <div role="row" className="heatmap-row" key={label}>
                    <span className="heatmap-weekday" aria-hidden="true">
                      {label}
                    </span>
                    {grid.map((week) => {
                      const day = week[row]!
                      return (
                        <div role="gridcell" key={day.date}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <button
                                className="heatmap-cell"
                                disabled={day.future}
                                tabIndex={day.date === selected ? 0 : -1}
                                aria-label={description(day)}
                                ref={(node) => {
                                  if (node) buttons.current.set(day.date, node)
                                  else buttons.current.delete(day.date)
                                }}
                                onFocus={() => setSelected(day.date)}
                                onKeyDown={(e) => move(e, day.date)}
                              >
                                <span
                                  className="heatmap-mark"
                                  data-level={day.level}
                                  data-today={day.date === today}
                                  aria-hidden="true"
                                >
                                  {day.points > 0 ? '·' : ''}
                                </span>
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="heatmap-tooltip">
                                {description(day)}
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </div>
                      )
                    })}
                  </div>
                ),
              )}
            </div>
          </div>
        </Tooltip.Provider>
      )}
      <p className="form-help">
        Tarefas concluídas, hábitos registrados, foco encerrado e flashcards
        revisados. XP não entra neste gráfico. Descansos e visitas a páginas não
        contam.
      </p>
    </section>
  )
}
