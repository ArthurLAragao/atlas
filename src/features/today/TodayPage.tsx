import { useEffect, useState, type ReactNode } from 'react'
import { addDays } from 'date-fns'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EntrySheet } from '../../components/EntrySheet'
import { usePreferences } from '../../app/preferences-store'
import { visibleWidgets, type WidgetId } from '../../lib/widgets'
import { WidgetOrganizer } from './WidgetOrganizer'
import { StudyWidget } from './StudyWidgets'
import { PageHeader } from '../../components/PageHeader'
import { useData } from '../../app/data-store'
import { useCommands } from '../../app/command-store'
import type { Goal, Task } from '../../data/models'
import { aggregateDay, dateKey, formatDay } from '../../lib/habits'
import { goalTaskProgress, nextAppointment, selectToday } from '../../lib/today'
import { selectedWeeklyGoal } from '../../lib/goals'
import { TaskList } from '../tasks/TaskList'
import { TaskForm } from '../tasks/TaskForm'
import { useTasks } from '../tasks/task-store'
import { HabitList } from '../habits/HabitList'
import { LogForm } from '../habits/LogForm'
import { useHabits } from '../habits/habit-store'
import { AppointmentForm } from './AppointmentForm'
import { WeeklyGoalForm } from './WeeklyGoalForm'
import { TodayDirection } from './TodayDirection'
import { TodayFeedback } from './TodayFeedback'
import { useClock } from './use-clock'
import '../../styles/tasks.css'
import '../../styles/habits.css'
import '../../styles/today.css'

type Sheet =
  | { kind: 'widgets' }
  | { kind: 'task'; task?: Task }
  | { kind: 'log'; habitId: string }
  | { kind: 'appointment'; task?: Task }
  | { kind: 'goal'; goal?: Goal }

export default function TodayPage() {
  const widgets = usePreferences((state) => state.preferences.widgets)
  const now = useClock()
  const today = dateKey(now)
  const data = useData((s) => s.data)
  const profileName = data.profile?.name.trim()
  const busy = useData((s) => s.busy)
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const day = selectToday(data.tasks, today, currentTime)
  const appointment = nextAppointment(data.tasks, now)
  const goal = selectedWeeklyGoal(data.goals)
  const progress = goal ? goalTaskProgress(goal, data.tasks) : undefined
  const total = aggregateDay(data.habits, data.habitLogs, today)
  const pending = day.tasks.filter((task) => task.status !== 'done').length
  useEffect(() => {
    void useTasks.getState().refreshUndo()
    void useHabits.getState().refreshUndo()
  }, [])

  function restoreTaskFocus(id: string, control: string) {
    requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-task-id]')
      const current = selectToday(
        useData.getState().data.tasks,
        today,
        currentTime,
      )
      const visible = [...current.tasks, ...current.overdue].some(
        (task) => task.id === id,
      )
      const row = visible
        ? [...rows].find((item) => item.dataset.taskId === id)
        : undefined
      const target = row?.querySelector<HTMLElement>(control)
      if (target) target.focus()
      else document.querySelector<HTMLButtonElement>('[data-new-task]')?.focus()
    })
  }
  async function status(task: Task, next: Task['status']) {
    const control = document.activeElement?.classList.contains('task-status')
      ? '.task-status'
      : '.task-check'
    if (await useTasks.getState().status(task, next))
      restoreTaskFocus(task.id, control)
  }
  async function postpone(task: Task) {
    if (
      await useTasks.getState().postpone(task, dateKey(addDays(new Date(), 1)))
    )
      restoreTaskFocus(task.id, '.task-postpone')
  }
  async function completeAppointment(task: Task) {
    if (await useTasks.getState().status(task, 'done'))
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>('[data-appointment-trigger]')
          ?.focus(),
      )
  }

  const views: Record<WidgetId, ReactNode> = {
    priorities: (
      <section className="today-section" aria-labelledby="today-tasks">
        <div className="section-heading">
          <div>
            <h2 id="today-tasks">Tarefas do dia</h2>
            <p className="form-help">
              {pending} pendentes · {day.tasks.length - pending} concluídas
            </p>
          </div>
          <button
            data-new-task
            className="button button-primary"
            disabled={busy}
            onClick={() => setSheet({ kind: 'task' })}
          >
            Nova tarefa
          </button>
        </div>
        {pending > 3 && (
          <p className="today-gentle" role="status">
            Há {pending} tarefas para hoje. Que tal escolher três e adiar o que
            puder esperar?
          </p>
        )}
        {day.tasks.length ? (
          <TaskList
            tasks={day.tasks}
            busy={busy}
            onEdit={(task) => setSheet({ kind: 'task', task })}
            onStatus={(task, next) => void status(task, next)}
            onPostpone={(task) => void postpone(task)}
          />
        ) : (
          <p className="today-empty">
            Seu dia tem espaço. Crie uma tarefa com prazo para hoje ou aproveite
            a pausa.
          </p>
        )}
        <Link className="today-link" to="/tarefas">
          Ver todas, incluindo sem prazo <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>
    ),
    review: day.overdue.length > 0 && (
      <section className="today-section" aria-labelledby="today-review">
        <div className="section-heading">
          <div>
            <h2 id="today-review">Revisar pendências</h2>
            <p className="form-help">
              {day.overdue.length} pendências entre horários de hoje e prazos
              anteriores. Conclua, ajuste ou adie; os prazos continuam como você
              deixou.
            </p>
          </div>
        </div>
        <TaskList
          tasks={day.overdue}
          busy={busy}
          onEdit={(task) => setSheet({ kind: 'task', task })}
          onStatus={(task, next) => void status(task, next)}
          onPostpone={(task) => void postpone(task)}
        />
      </section>
    ),
    habits: (
      <section className="today-section" aria-labelledby="today-habits">
        <div className="section-heading">
          <div>
            <h2 id="today-habits">Hábitos de hoje</h2>
            <p className="form-help">
              {total.completed} de {total.total} concluídos · {total.rest} em
              descanso
            </p>
          </div>
          <Link className="button" to="/habitos">
            Ver heatmap
          </Link>
        </div>
        {data.habits.length ? (
          <HabitList
            habits={data.habits}
            logs={data.habitLogs}
            today={today}
            busy={busy}
            selected=""
            onSelect={(id) =>
              navigate(`/habitos?habit=${encodeURIComponent(id)}`)
            }
            onRecord={(habitId) => setSheet({ kind: 'log', habitId })}
            onToggle={(habit, value) =>
              void useHabits.getState().log(habit.id, today, value, false)
            }
          />
        ) : (
          <p className="today-empty">
            Crie seu primeiro hábito na captura ou em Hábitos. Comece pequeno.
          </p>
        )}
      </section>
    ),
    appointment: (
      <TodayDirection
        only="appointment"
        appointment={appointment}
        goal={goal}
        progress={progress}
        today={today}
        busy={busy}
        onAppointment={() =>
          setSheet({ kind: 'appointment', task: appointment })
        }
        onGoal={() => setSheet({ kind: 'goal', goal })}
        onComplete={(task) => void completeAppointment(task)}
      />
    ),
    goal: (
      <TodayDirection
        only="goal"
        appointment={appointment}
        goal={goal}
        progress={progress}
        today={today}
        busy={busy}
        onAppointment={() =>
          setSheet({ kind: 'appointment', task: appointment })
        }
        onGoal={() => setSheet({ kind: 'goal', goal })}
        onComplete={(task) => void completeAppointment(task)}
      />
    ),
    exam: <StudyWidget id="exam" now={now} />,
    path: <StudyWidget id="path" now={now} />,
    flashcards: <StudyWidget id="flashcards" now={now} />,
    focus: <StudyWidget id="focus" now={now} />,
  }
  return (
    <div className="today-page">
      <PageHeader title="Hoje" eyebrow={formatDay(today)}>
        Um dia de cada vez{profileName ? `, ${profileName}` : ''}. Escolha
        poucos passos e deixe espaço para respirar.
      </PageHeader>
      <div className="today-actions">
        <div className="today-capture">
          <button
            className="button"
            onClick={() => useCommands.getState().openPalette()}
          >
            <Plus aria-hidden="true" /> Anotar algo
          </button>
          <span className="form-help">Tarefa, nota ou hábito · Ctrl/Cmd+K</span>
        </div>
        <button
          className="button"
          onClick={() => setSheet({ kind: 'widgets' })}
        >
          Organizar Hoje
        </button>
      </div>
      {!sheet && <TodayFeedback />}
      <div
        className="today-widget-grid"
        data-editorial={
          visibleWidgets(widgets)
            .filter((id) => id !== 'review' || day.overdue.length > 0)
            .slice(0, 3)
            .join(',') === 'priorities,appointment,goal'
        }
      >
        {visibleWidgets(widgets).length ? (
          visibleWidgets(widgets).map((id) => (
            <div key={id} data-today-widget={id}>
              {views[id]}
            </div>
          ))
        ) : (
          <p className="today-empty">
            Hoje está livre. Use Organizar Hoje para adicionar seu primeiro
            widget.
          </p>
        )}
      </div>
      {sheet?.kind === 'widgets' && (
        <EntrySheet
          title="Organizar Hoje"
          description="Seu dia, na ordem que faz sentido para você."
          onClose={() => setSheet(null)}
        >
          <WidgetOrganizer />
        </EntrySheet>
      )}
      {sheet?.kind === 'task' && (
        <TaskForm
          task={sheet.task}
          initialDate={today}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'log' && (
        <LogForm
          initialHabitId={sheet.habitId}
          initialDate={today}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'appointment' && (
        <AppointmentForm task={sheet.task} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'goal' && (
        <WeeklyGoalForm goal={sheet.goal} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}
