import type { Habit, HabitLog } from '../../data/models'
import { previousNight, scheduledDay } from '../../lib/habit-schedule'
import { habitDay, formatDay } from '../../lib/habits'

export function PreviousNight({
  habits,
  logs,
  today,
  onRecord,
}: {
  habits: Habit[]
  logs: HabitLog[]
  today: string
  onRecord: (id: string, date: string) => void
}) {
  const previous = previousNight(habits, today)
  const pending = previous.habits.filter((h) => {
    const d = habitDay(h, logs, previous.date)
    return !d.completed && !d.rest
  })
  if (!pending.length) return null
  return (
    <aside className="habit-undo" aria-label="Noite anterior">
      <p className="form-help">
        Noite anterior · os registros abaixo pertencem a{' '}
        {formatDay(previous.date)}.
      </p>
      {pending.map((h) => (
        <div className="button-row" key={h.id}>
          <span>
            {scheduledDay(h, previous.date).label} ·{' '}
            {scheduledDay(h, previous.date).time} da madrugada seguinte
          </span>
          <button
            className="button"
            onClick={() => onRecord(h.id, previous.date)}
          >
            Registrar em Ontem
          </button>
        </div>
      ))}
    </aside>
  )
}
