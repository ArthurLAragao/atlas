import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { EntrySheet } from './EntrySheet'
import { calendarDays } from '../lib/tasks'
import { dateKey } from '../lib/habits'
import { moveCalendarDate } from '../lib/date-picker'
export function DatePicker({
  label,
  value,
  min = '0001-01-01',
  max = '9999-12-31',
  required,
  onSelect,
  onClose,
  inline = false,
}: {
  label: string
  value: string
  min?: string
  max?: string
  required?: boolean
  onSelect: (date: string) => void
  onClose: () => void
  inline?: boolean
}) {
  const today = dateKey(new Date())
  const first = value || (today < min ? min : today > max ? max : today)
  const [active, setActive] = useState(first),
    [month, setMonth] = useState(startOfMonth(parseISO(first)))
  const buttons = useRef(new Map<string, HTMLButtonElement>()),
    pending = useRef(false),
    initial = useRef<HTMLButtonElement>(null)
  const days = calendarDays(month),
    monthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR })
  const allowed = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/u.test(date) && date >= min && date <= max
  function move(date: string) {
    if (!allowed(date)) return
    pending.current = true
    setActive(date)
    setMonth(startOfMonth(parseISO(date)))
  }
  useLayoutEffect(() => {
    if (pending.current) {
      buttons.current.get(active)?.focus()
      pending.current = false
    }
  }, [active, month])
  useLayoutEffect(() => {
    if (inline) initial.current?.focus()
  }, [inline])
  function frame(children: ReactNode) {
    return inline ? (
      children
    ) : (
      <EntrySheet
        title={`Calendário: ${label}`}
        description="Setas percorrem dias; Home/End percorrem a semana; Page Up/Page Down mudam o mês. Enter escolhe, Escape cancela."
        onClose={onClose}
        initialFocus={initial}
        className="date-picker-sheet"
      >
        {children}
      </EntrySheet>
    )
  }
  return frame(
    <div className="date-picker">
      <div className="date-picker-heading">
        <button
          type="button"
          className="icon-button"
          aria-label="Mês anterior"
          disabled={!allowed(dateKey(addMonths(parseISO(active), -1)))}
          onClick={() => move(dateKey(addMonths(parseISO(active), -1)))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <h3 aria-live="polite">{monthLabel}</h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Próximo mês"
          disabled={!allowed(dateKey(addMonths(parseISO(active), 1)))}
          onClick={() => move(dateKey(addMonths(parseISO(active), 1)))}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div
        className="date-picker-scroll"
        role="region"
        tabIndex={0}
        aria-label="Dias do mês, com rolagem em texto ampliado"
      >
        <div role="grid" className="date-picker-grid" aria-label={monthLabel}>
          <div role="row" className="date-picker-week">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
              <span role="columnheader" key={d}>
                {d}
              </span>
            ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <div role="row" className="date-picker-week" key={week}>
              {days.slice(week * 7, (week + 1) * 7).map(({ date }) => {
                const selected = date === value,
                  isToday = date === today
                return (
                  <div role="gridcell" aria-selected={selected} key={date}>
                    <button
                      type="button"
                      className="date-picker-day"
                      data-selected={selected}
                      data-outside={
                        date.slice(0, 7) !== dateKey(month).slice(0, 7)
                      }
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}${isToday ? ' · Hoje' : ''}${selected ? ' · Selecionada' : ''}`}
                      disabled={!allowed(date)}
                      tabIndex={date === active ? 0 : -1}
                      ref={(node) => {
                        if (node) {
                          buttons.current.set(date, node)
                          if (date === first) initial.current = node
                        } else buttons.current.delete(date)
                      }}
                      onFocus={() => setActive(date)}
                      onClick={() => onSelect(date)}
                      onKeyDown={(e) => {
                        const next = moveCalendarDate(date, e.key)
                        if (next) {
                          e.preventDefault()
                          move(next)
                        }
                      }}
                    >
                      <span>{parseISO(date).getDate()}</span>
                      {selected ? (
                        <Check aria-hidden="true" />
                      ) : isToday ? (
                        <span aria-hidden="true" className="date-today-dot">
                          ·
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="button-row">
        <button
          className="button"
          type="button"
          disabled={!allowed(today)}
          onClick={() => onSelect(today)}
        >
          Hoje
        </button>
        {!required && (
          <button className="button" type="button" onClick={() => onSelect('')}>
            Sem data
          </button>
        )}
        <button className="button" type="button" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>,
  )
}
