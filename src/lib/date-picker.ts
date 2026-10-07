import { addDays, addMonths, parseISO, startOfWeek } from 'date-fns'
import { dateKey } from './habits'
export function moveCalendarDate(date: string, key: string): string | null {
  const current = parseISO(date)
  switch (key) {
    case 'ArrowLeft':
      return dateKey(addDays(current, -1))
    case 'ArrowRight':
      return dateKey(addDays(current, 1))
    case 'ArrowUp':
      return dateKey(addDays(current, -7))
    case 'ArrowDown':
      return dateKey(addDays(current, 7))
    case 'Home':
      return dateKey(startOfWeek(current, { weekStartsOn: 1 }))
    case 'End':
      return dateKey(addDays(startOfWeek(current, { weekStartsOn: 1 }), 6))
    case 'PageUp':
      return dateKey(addMonths(current, -1))
    case 'PageDown':
      return dateKey(addMonths(current, 1))
    default:
      return null
  }
}
