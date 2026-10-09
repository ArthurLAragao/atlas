import { DateField } from '../../components/DateField'
import { addDays } from 'date-fns'
import { dateKey, formatDay } from '../../lib/habits'
import type { useSelectedDay } from './use-selected-day'

export function DaySelector({
  day,
}: {
  day: ReturnType<typeof useSelectedDay>
}) {
  const yesterday = dateKey(addDays(new Date(`${day.today}T12:00:00`), -1))
  return (
    <div
      className="history-controls"
      role="group"
      aria-label="Seleção do dia dos hábitos"
    >
      <div className="button-row">
        <button
          type="button"
          className="button"
          aria-pressed={day.followingToday}
          onClick={day.chooseToday}
        >
          Hoje
        </button>
        <button
          type="button"
          className="button"
          aria-pressed={!day.followingToday && day.selectedDate === yesterday}
          onClick={day.chooseYesterday}
        >
          Ontem
        </button>
      </div>
      <label className="form-field">
        Dia dos hábitos
        <DateField
          label="Dia dos hábitos"
          value={day.selectedDate}
          max={day.today}
          required
          onValueChange={day.chooseDate}
        />
      </label>
      <span className="form-help">
        Registros em {formatDay(day.selectedDate)}
        {day.followingToday ? '' : ' · data fixa, sem alterar Hoje'}.
      </span>
    </div>
  )
}
