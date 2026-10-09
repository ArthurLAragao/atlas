import { useState } from 'react'
import { addDays, isValid, parseISO } from 'date-fns'
import { dateKey } from '../../lib/habits'

/** Historical selection is a frozen local date, never a moving 'yesterday'. */
export function useSelectedDay(now: Date) {
  const [fixedDate, setFixedDate] = useState<string | null>(null)
  const today = dateKey(now)
  const selectedDate = fixedDate ?? today
  return {
    today,
    selectedDate,
    followingToday: fixedDate === null,
    chooseToday: () => setFixedDate(null),
    chooseYesterday: () => setFixedDate(dateKey(addDays(now, -1))),
    chooseDate: (date: string) => {
      const parsed = parseISO(date)
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        isValid(parsed) &&
        dateKey(parsed) === date &&
        date <= today
      )
        setFixedDate(date)
    },
  }
}
