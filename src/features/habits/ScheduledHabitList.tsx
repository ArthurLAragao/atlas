import type { ComponentProps } from 'react'
import { HabitList } from './HabitList'
import { scheduledHabits } from '../../lib/habit-schedule'

export function ScheduledHabitList(props: ComponentProps<typeof HabitList>) {
  const required = scheduledHabits(props.habits, props.today)
  const optional = scheduledHabits(props.habits, props.today, true)
  return (
    <>
      {required.length ? (
        <HabitList {...props} habits={required} />
      ) : (
        <p className="today-empty">
          Nenhum hábito obrigatório programado para esta data. Descanso também
          faz parte.
        </p>
      )}
      {optional.length > 0 && (
        <details className="routine-optionals">
          <summary>
            Opcionais ({optional.length}) · fora do progresso obrigatório
          </summary>
          <HabitList {...props} habits={optional} />
        </details>
      )}
    </>
  )
}
