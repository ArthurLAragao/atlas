import * as Tooltip from '@radix-ui/react-tooltip'
import { m as motion } from 'framer-motion'
import { useAtlasReducedMotion } from '../../app/use-motion'
import { Check, Minus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Habit, HabitLog } from '../../data/models'
import {
  aggregateDay,
  formatDay,
  generateHeatmap,
  habitDay,
  intensity,
} from '../../lib/habits'

function dayDescription(
  habits: Habit[],
  logs: HabitLog[],
  date: string,
  habit?: Habit,
) {
  if (habit) {
    const day = habitDay(habit, logs, date)
    return day.rest
      ? 'Descanso'
      : habit.kind === 'binary'
        ? day.completed
          ? 'Concluído'
          : 'Não concluído'
        : `${day.value.toLocaleString('pt-BR')} de ${habit.target.toLocaleString('pt-BR')} ${habit.unit}`
  }
  const day = aggregateDay(habits, logs, date)
  return `${day.completed} de ${day.total} hábitos concluídos · ${day.rest} em descanso · ${Math.round(day.ratio * 100)}% dos alvos`
}

export function Heatmap({
  habits,
  logs,
  habit,
  today,
  weeks,
  onEdit,
}: {
  habits: Habit[]
  logs: HabitLog[]
  habit?: Habit
  today: string
  weeks: number
  onEdit: (date: string) => void
}) {
  const grid = generateHeatmap(today, weeks)
  const flat = grid.flat()
  const days = flat.filter((day) => !day.future)
  // Bound lookups to the day's entries instead of scanning the full history per mark.
  const logsByDate = new Map<string, HabitLog[]>()
  for (const log of logs) {
    const entries = logsByDate.get(log.date) ?? []
    entries.push(log)
    logsByDate.set(log.date, entries)
  }
  const entriesFor = (date: string) => logsByDate.get(date) ?? []
  const [focused, setFocused] = useState(today)
  const [textMode, setTextMode] = useState(false)
  const [page, setPage] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const hintId = useId()
  const reduce = useAtlasReducedMotion()
  const completed = days.filter((day) =>
    habit
      ? habitDay(habit, entriesFor(day.date), day.date).completed
      : aggregateDay(habits, entriesFor(day.date), day.date).completed > 0,
  ).length
  const recent = [...days].reverse().slice(page * 28, page * 28 + 28)
  const currentFocus = days.some((day) => day.date === focused)
    ? focused
    : today
  useEffect(() => {
    // The latest week is immediately available on narrow screens.
    if (container.current)
      container.current.scrollLeft = container.current.scrollWidth
  }, [weeks, habit?.id, textMode])
  function move(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const index = flat.findIndex((day) => day.date === date)
    const row = index % 7
    const moves: Record<string, number> = {
      ArrowLeft: index - 7,
      ArrowRight: index + 7,
      ArrowUp: row > 0 ? index - 1 : index,
      ArrowDown: row < 6 ? index + 1 : index,
      Home: index - row,
      End: index + 6 - row,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    const target =
      flat[Math.max(0, Math.min(days.length - 1, moves[event.key] ?? index))]
    if (target && !target.future) {
      setFocused(target.date)
      buttons.current.get(target.date)?.focus({ preventScroll: true })
      buttons.current
        .get(target.date)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }
  return (
    <section className="heatmap-section" aria-labelledby={`${hintId}-title`}>
      <div className="section-heading">
        <div>
          <h2 id={`${hintId}-title`}>
            {habit ? habit.title : 'Seu ritmo, dia a dia'}
          </h2>
          <p className="form-help">
            {completed}{' '}
            {habit
              ? 'dias com alvo atingido'
              : 'dias com pelo menos um hábito concluído'}{' '}
            nas últimas {weeks} semanas.
          </p>
        </div>
        <button
          className="button"
          aria-pressed={textMode}
          onClick={() => {
            setTextMode(!textMode)
            setPage(0)
          }}
        >
          {textMode ? 'Ver gráfico' : 'Ver em texto'}
        </button>
      </div>
      <p id={hintId} className="heatmap-hint">
        Semanas em colunas; segunda a domingo em linhas. Use as setas para
        escolher um dia e Enter para editar.{' '}
        {habit
          ? `Intensidade relativa ao alvo de ${habit.target.toLocaleString('pt-BR')} ${habit.unit}.`
          : 'Intensidade: média dos alvos de cada hábito, sem os descansos.'}
      </p>
      {textMode ? (
        <div className="history-text">
          <table>
            <caption>
              Histórico de {habit?.title ?? 'todos os hábitos'} — mesmos dias do
              gráfico
            </caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Registro</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{formatDay(day.date)}</th>
                  <td>
                    {dayDescription(
                      habits,
                      entriesFor(day.date),
                      day.date,
                      habit,
                    )}
                  </td>
                  <td>
                    <button
                      className="button"
                      onClick={() => onEdit(day.date)}
                      aria-label={`Editar ${formatDay(day.date)}`}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="button-row">
            <button
              className="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Recentes
            </button>
            <span className="caption">
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
        </div>
      ) : (
        <motion.div
          initial={false}
          className={reduce ? undefined : 'heatmap-enter'}
        >
          <Tooltip.Provider delayDuration={250}>
            <div className="heatmap-scroll" ref={container}>
              <div className="heatmap-months" aria-hidden="true">
                {grid.map((week, index) => {
                  const first = week[0]!
                  const previous = grid[index - 1]?.[0]
                  return (
                    <span key={first.date}>
                      {!previous ||
                      previous.date.slice(0, 7) !== first.date.slice(0, 7)
                        ? format(parseISO(first.date), 'MMM', { locale: ptBR })
                        : ''}
                    </span>
                  )
                })}
              </div>
              <div
                role="grid"
                aria-label={`Histórico de ${habit?.title ?? 'todos os hábitos'}`}
                aria-describedby={hintId}
                aria-rowcount={7}
                aria-colcount={weeks}
                data-testid="heatmap"
                className="heatmap-grid"
              >
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(
                  (label, row) => (
                    <div role="row" key={label} className="heatmap-row">
                      <span className="heatmap-weekday" aria-hidden="true">
                        {label}
                      </span>
                      {grid.map((week, col) => {
                        const day = week[row]!
                        const value = habit
                          ? habitDay(habit, entriesFor(day.date), day.date)
                          : aggregateDay(habits, entriesFor(day.date), day.date)
                        const rest = habit
                          ? Boolean(value.rest)
                          : aggregateDay(habits, entriesFor(day.date), day.date)
                              .rest === habits.length
                        const level = intensity(value.ratio)
                        const description = `${formatDay(day.date)} · ${day.future ? 'Dia futuro' : dayDescription(habits, entriesFor(day.date), day.date, habit)}`
                        return (
                          <div
                            role="gridcell"
                            aria-colindex={col + 1}
                            key={day.date}
                          >
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button
                                  className="heatmap-cell"
                                  data-date={day.date}
                                  aria-label={description}
                                  tabIndex={
                                    !day.future && day.date === currentFocus
                                      ? 0
                                      : -1
                                  }
                                  disabled={day.future}
                                  ref={(node) => {
                                    if (node)
                                      buttons.current.set(day.date, node)
                                    else buttons.current.delete(day.date)
                                  }}
                                  onFocus={() => setFocused(day.date)}
                                  onKeyDown={(e) => move(e, day.date)}
                                  onClick={() => onEdit(day.date)}
                                >
                                  <span
                                    className="heatmap-mark"
                                    data-level={level}
                                    data-rest={rest}
                                    data-today={day.date === today}
                                    aria-hidden="true"
                                  >
                                    {rest ? (
                                      <Minus />
                                    ) : level === 4 ? (
                                      <Check />
                                    ) : level > 0 ? (
                                      <span className="heatmap-dot" />
                                    ) : null}
                                  </span>
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="heatmap-tooltip"
                                  sideOffset={8}
                                >
                                  {description}
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
          <div className="heatmap-legend">
            <span>Sem progresso</span>
            <div aria-hidden="true" className="legend-scale">
              {[0, 1, 2, 3, 4].map((n) => (
                <span className="heatmap-mark" data-level={n} key={n} />
              ))}
            </div>
            <span>Alvo atingido</span>
            <span className="caption">✓ Concluído · — Descanso</span>
          </div>
        </motion.div>
      )}
    </section>
  )
}
