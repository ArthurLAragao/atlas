import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Minus, Plus } from 'lucide-react'
import { m as motion } from 'framer-motion'
import { useAtlasReducedMotion } from '../../app/use-motion'
import type { Habit, HabitLog } from '../../data/models'
import { dateKey, getStreaks, habitDay, weekProgress } from '../../lib/habits'
import { plannedTime, scheduledDay } from '../../lib/habit-schedule'

export function HabitList({
  habits,
  logs,
  today,
  busy,
  selected,
  onSelect,
  onRecord,
  onToggle,
}: {
  habits: Habit[]
  logs: HabitLog[]
  today: string
  busy: boolean
  selected: string
  onSelect: (id: string) => void
  onRecord: (id: string) => void
  onToggle: (habit: Habit, value: number) => void
}) {
  const reduced = useAtlasReducedMotion()
  const byHabit = new Map<string, HabitLog[]>()
  for (const log of logs) {
    const existing = byHabit.get(log.habitId) ?? []
    existing.push(log)
    byHabit.set(log.habitId, existing)
  }
  function row(habit: Habit) {
    const entries = byHabit.get(habit.id) ?? []
    const day = habitDay(habit, entries, today)
    const streak = getStreaks(habit, entries, today)
    const week = weekProgress(habit, entries, today)
    const plan = scheduledDay(habit, today)
    const label = plan.label
    const dateWord =
      today === dateKey(new Date()) ? 'hoje' : 'na data selecionada'
    return (
      <div className="habit-row" data-selected={habit.id === selected}>
        {habit.kind === 'binary' ? (
          <motion.button
            className="habit-check"
            aria-label={
              day.completed
                ? `Desmarcar ${label}`
                : `Marcar ${label} como concluído`
            }
            aria-pressed={day.completed}
            disabled={busy}
            whileTap={reduced ? undefined : { scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            onClick={() => onToggle(habit, day.completed ? 0 : 1)}
          >
            {day.completed ? (
              <Check aria-hidden="true" />
            ) : day.rest ? (
              <Minus aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
          </motion.button>
        ) : (
          <button
            className="habit-check"
            disabled={busy}
            aria-label={`Registrar ${label}`}
            onClick={() => onRecord(habit.id)}
          >
            {day.rest ? (
              <Minus aria-hidden="true" />
            ) : day.completed ? (
              <Check aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
          </button>
        )}
        <div className="habit-information">
          <button
            className="habit-name"
            aria-label={`Ver histórico de ${habit.title}`}
            aria-describedby={`habit-day-${habit.id}`}
            aria-pressed={selected === habit.id}
            onClick={() => onSelect(habit.id)}
          >
            <strong>{label}</strong>
          </button>
          <span className="habit-day" id={`habit-day-${habit.id}`}>
            {day.rest
              ? `Descanso ${dateWord}`
              : habit.kind === 'binary'
                ? day.completed
                  ? `Concluído ${dateWord}`
                  : `Ainda não registrado ${dateWord}`
                : `${day.value.toLocaleString('pt-BR')} / ${plan.target.toLocaleString('pt-BR')} ${plan.unit} na data selecionada`}
          </span>
          {habit.scheduleVersions && (
            <span className="form-help">
              {plan.scheduled
                ? `${plannedTime(plan)}${plan.optional ? ' · Opcional' : ''}`
                : 'Fora da programação deste dia'}
            </span>
          )}
        </div>
        <div className="habit-rhythm">
          <span>
            {week.required === 0
              ? 'Semana de descanso'
              : `${week.completed}/${week.required} nesta semana`}
          </span>
          <span>
            {streak.current
              ? `${streak.current} ${streak.current === 1 ? streak.unit.slice(0, -1) : streak.unit} em sequência`
              : 'Comece hoje'}
            {habit.isExample ? ' · Exemplo' : ''}
          </span>
        </div>
      </div>
    )
  }
  if (habits.length > 200)
    return <VirtualHabitList habits={habits} render={row} />
  return (
    <ul className="habit-list" data-testid="habit-list">
      {habits.map((habit) => (
        <li key={habit.id}>{row(habit)}</li>
      ))}
    </ul>
  )
}

function VirtualHabitList({
  habits,
  render,
}: {
  habits: Habit[]
  render: (habit: Habit) => ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<number | null>(null)
  // React Compiler is not enabled here; TanStack owns its measured, mutable layout.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: habits.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 112,
    overscan: 5,
  })
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-habit-index]',
    )
    if (!current) return
    event.preventDefault()
    const index = Number(current.dataset.habitIndex)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? habits.length - 1
          : Math.max(
              0,
              Math.min(
                habits.length - 1,
                index + (event.key === 'ArrowDown' ? 1 : -1),
              ),
            )
    pendingFocus.current = next
    virtual.scrollToIndex(next, { align: 'auto' })
    requestAnimationFrame(() => {
      const button = scroller.current?.querySelector<HTMLButtonElement>(
        `[data-habit-index="${next}"] .habit-name`,
      )
      if (button) {
        button.focus()
        pendingFocus.current = null
      }
    })
  }
  return (
    <>
      <p className="form-help">
        Lista longa: use ↑/↓ para percorrer hábitos e Home/End para ir ao
        início/fim.
      </p>
      <div
        ref={scroller}
        className="habit-list-scroll"
        data-testid="habit-list"
        onKeyDown={move}
      >
        <div
          role="list"
          aria-label="Seus hábitos"
          className="habit-virtual-space"
          style={{ height: virtual.getTotalSize() }}
        >
          {virtual.getVirtualItems().map((item) => (
            <div
              role="listitem"
              aria-setsize={habits.length}
              aria-posinset={item.index + 1}
              data-habit-index={item.index}
              data-index={item.index}
              key={habits[item.index]!.id}
              className="habit-virtual-row"
              style={{ transform: `translateY(${item.start}px)` }}
              ref={(node) => {
                virtual.measureElement(node)
                if (node && pendingFocus.current === item.index) {
                  node.querySelector<HTMLButtonElement>('.habit-name')?.focus()
                  pendingFocus.current = null
                }
              }}
            >
              {render(habits[item.index]!)}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
