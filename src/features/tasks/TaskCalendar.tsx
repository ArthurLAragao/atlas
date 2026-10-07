import { DateField } from '../../components/DateField'
import { useRef, useState, type KeyboardEvent } from 'react'
import {
  addDays,
  addMonths,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Task } from '../../data/models'
import { dateKey } from '../../lib/habits'
import { calendarDays } from '../../lib/tasks'
import { TaskList } from './TaskList'
import '../../styles/task-views.css'

interface TaskCalendarProps {
  tasks: Task[]
  busy: boolean
  onEdit: (task: Task) => void
  onStatus: (task: Task, status: Task['status']) => void
  onNew: (date: string) => void
}

const weekdays = [
  ['Seg', 'segunda-feira'],
  ['Ter', 'terça-feira'],
  ['Qua', 'quarta-feira'],
  ['Qui', 'quinta-feira'],
  ['Sex', 'sexta-feira'],
  ['Sáb', 'sábado'],
  ['Dom', 'domingo'],
] as const

function fullDate(date: string) {
  return format(parseISO(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function TaskCalendar({
  tasks,
  busy,
  onEdit,
  onStatus,
  onNew,
}: TaskCalendarProps) {
  const today = dateKey(new Date())
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)))
  const [selected, setSelected] = useState(today)
  const [undated, setUndated] = useState(false)
  const pendingFocus = useRef<string | null>(null)
  const days = calendarDays(month)
  const rawMonthLabel = format(month, "MMMM 'de' yyyy", { locale: ptBR })
  const monthLabel =
    rawMonthLabel.charAt(0).toLocaleUpperCase('pt-BR') + rawMonthLabel.slice(1)
  const byDate = new Map<string, Task[]>()
  const withoutDate = tasks.filter((task) => task.dueDate === null)
  for (const task of tasks) {
    if (task.dueDate === null) continue
    const existing = byDate.get(task.dueDate) ?? []
    existing.push(task)
    byDate.set(task.dueDate, existing)
  }
  const selectedTasks = undated ? withoutDate : (byDate.get(selected) ?? [])

  function select(date: string, focus = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return
    const parsed = parseISO(date)
    if (
      !isValid(parsed) ||
      parsed.getFullYear() < 1 ||
      dateKey(parsed) !== date
    )
      return
    if (focus) pendingFocus.current = date
    setMonth(startOfMonth(parsed))
    setSelected(date)
    setUndated(false)
  }

  function navigate(interval: number) {
    select(dateKey(addMonths(parseISO(selected), interval)))
  }

  function move(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const parsed = parseISO(date)
    let next: Date
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(parsed, -1)
        break
      case 'ArrowRight':
        next = addDays(parsed, 1)
        break
      case 'ArrowUp':
        next = addDays(parsed, -7)
        break
      case 'ArrowDown':
        next = addDays(parsed, 7)
        break
      case 'Home':
        next = startOfWeek(parsed, { weekStartsOn: 1 })
        break
      case 'End':
        next = addDays(startOfWeek(parsed, { weekStartsOn: 1 }), 6)
        break
      case 'PageUp':
        next = addMonths(parsed, -1)
        break
      case 'PageDown':
        next = addMonths(parsed, 1)
        break
      default:
        return
    }
    event.preventDefault()
    select(dateKey(next), true)
  }

  return (
    <section className="task-calendar" aria-label="Calendário de tarefas">
      <header className="task-calendar-toolbar">
        <div className="task-month-navigation">
          <button
            type="button"
            className="icon-button"
            aria-label="Mês anterior"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h2 className="task-month-title" aria-live="polite">
            {monthLabel}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Próximo mês"
            onClick={() => navigate(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => select(today)}
          >
            Hoje
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={undated}
            onClick={() => setUndated((current) => !current)}
          >
            Sem prazo ({withoutDate.length})
          </button>
        </div>
      </header>
      <label className="task-calendar-date-field">
        Selecionar data
        <DateField
          label="Selecionar data"
          min="0001-01-01"
          max="9999-12-31"
          value={selected}
          onValueChange={select}
        />
      </label>
      <p className="task-view-help" id="task-calendar-help">
        Dias com tarefas mostram a quantidade. Selecione um dia para ver a
        lista. Use as setas para percorrer dias e Page Up/Page Down para mudar o
        mês.
      </p>
      <div className="task-calendar-scroll">
        <div
          role="grid"
          aria-label={monthLabel}
          aria-describedby="task-calendar-help"
          className="task-calendar-grid"
        >
          <div role="row" className="task-calendar-weekday-row">
            {weekdays.map(([short, full]) => (
              <div role="columnheader" aria-label={full} key={full}>
                {short}
              </div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div role="row" className="task-calendar-week" key={week}>
              {days.slice(week * 7, week * 7 + 7).map((day) => {
                const count = byDate.get(day.date)?.length ?? 0
                return (
                  <div
                    role="gridcell"
                    aria-selected={!undated && selected === day.date}
                    key={day.date}
                  >
                    <button
                      type="button"
                      className="task-calendar-day"
                      tabIndex={selected === day.date ? 0 : -1}
                      aria-current={day.date === today ? 'date' : undefined}
                      aria-label={`${fullDate(day.date)}${day.date === today ? ', hoje' : ''}, ${count} ${count === 1 ? 'tarefa' : 'tarefas'}`}
                      data-in-month={day.inMonth}
                      data-selected={!undated && selected === day.date}
                      data-calendar-date={day.date}
                      onClick={() => select(day.date, true)}
                      onKeyDown={(event) => move(event, day.date)}
                      ref={(node) => {
                        if (node && pendingFocus.current === day.date) {
                          node.focus()
                          pendingFocus.current = null
                        }
                      }}
                    >
                      <span aria-hidden="true">
                        {Number(day.date.slice(-2))}
                      </span>
                      {count > 0 && (
                        <span
                          className="task-calendar-count"
                          aria-hidden="true"
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <section
        className="task-calendar-selection"
        aria-labelledby="task-calendar-selection-heading"
      >
        <div className="section-heading">
          <div>
            <h2 id="task-calendar-selection-heading">
              {undated ? 'Sem prazo' : fullDate(selected)}
            </h2>
            <p className="caption">
              {selectedTasks.length}{' '}
              {selectedTasks.length === 1 ? 'tarefa' : 'tarefas'}
            </p>
          </div>
          {!undated && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => onNew(selected)}
            >
              <Plus aria-hidden="true" />
              Nova tarefa neste dia
            </button>
          )}
        </div>
        {selectedTasks.length ? (
          <TaskList
            tasks={selectedTasks}
            busy={busy}
            onEdit={onEdit}
            onStatus={onStatus}
          />
        ) : (
          <p className="task-calendar-empty">
            {undated
              ? 'Nenhuma tarefa sem prazo. Crie uma tarefa sem data para deixá-la aqui.'
              : 'Nenhuma tarefa neste dia. Use Nova tarefa neste dia para começar.'}
          </p>
        )}
      </section>
    </section>
  )
}
