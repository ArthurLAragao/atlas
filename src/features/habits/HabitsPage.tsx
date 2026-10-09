import { TransientToast } from '../../components/TransientToast'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Plus, Pencil, X } from 'lucide-react'
import { useData } from '../../app/data-store'
import { PageHeader } from '../../components/PageHeader'
import { aggregateDay, getStreaks, weekProgress } from '../../lib/habits'
import type { Habit } from '../../data/models'
import { useHabits } from './habit-store'
import { HabitForm } from './HabitForm'
import { LogForm } from './LogForm'
import { HabitList } from './HabitList'
import { Heatmap } from './Heatmap'
import { ScheduledHabitList } from './ScheduledHabitList'
import { DaySelector } from './DaySelector'
import { PreviousNight } from './PreviousNight'
import { useSelectedDay } from './use-selected-day'
import { useClock } from '../today/use-clock'
const RoutineImport = lazy(() => import('./RoutineImport'))
import '../../styles/habits.css'

type Sheet =
  | { type: 'routine' }
  | { type: 'habit'; habit?: Habit }
  | { type: 'log'; habitId: string; date: string }

export default function HabitsPage() {
  const [params] = useSearchParams()
  return (
    <HabitWorkspace
      key={params.get('habit') ?? 'all'}
      initialHabit={params.get('habit') ?? 'all'}
    />
  )
}
function HabitWorkspace({ initialHabit }: { initialHabit: string }) {
  const data = useData((s) => s.data)
  const busy = useData((s) => s.busy)
  const now = useClock()
  const day = useSelectedDay(now)
  const today = day.selectedDate
  const [library, setLibrary] = useState(false)
  const [selectedId, setSelectedId] = useState(initialHabit)
  const [weeks, setWeeks] = useState(13)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const canUndo = useHabits((s) => s.canUndo)
  const undo = useHabits((s) => s.undo)
  const log = useHabits((s) => s.log)
  const refreshUndo = useHabits((s) => s.refreshUndo)
  useEffect(() => {
    void refreshUndo()
  }, [refreshUndo])
  const habit = data.habits.find((item) => item.id === selectedId)
  const selected = habit?.id ?? 'all'
  const streak = habit ? getStreaks(habit, data.habitLogs, today) : undefined
  const progress = habit
    ? weekProgress(habit, data.habitLogs, today)
    : undefined
  const total = aggregateDay(data.habits, data.habitLogs, today)
  function record(date: string, habitId = habit?.id ?? data.habits[0]?.id) {
    if (habitId) setSheet({ type: 'log', habitId, date })
  }
  return (
    <div className="habits-page">
      <PageHeader title="Hábitos" eyebrow="Pequenos passos, seu ritmo">
        Consistência que você consegue enxergar. Registre hoje, cuide do
        descanso e acompanhe o que se repete.
      </PageHeader>
      <DaySelector day={day} />
      <div className="button-row">
        <button
          className="button"
          aria-pressed={!library}
          onClick={() => setLibrary(false)}
        >
          Hábitos do dia
        </button>
        <button
          className="button"
          aria-pressed={library}
          onClick={() => setLibrary(true)}
        >
          Biblioteca ({data.habits.length})
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => setSheet({ type: 'routine' })}
        >
          Importar rotina semanal
        </button>
      </div>
      {day.followingToday && (
        <PreviousNight
          habits={data.habits}
          logs={data.habitLogs}
          today={day.today}
          onRecord={(id, date) => record(date, id)}
        />
      )}
      <div className="section-heading">
        <div>
          <h2>
            {library
              ? 'Biblioteca de hábitos'
              : day.followingToday
                ? 'Hoje'
                : 'Dia selecionado'}
          </h2>
          <p className="form-help">
            {total.total
              ? `${total.completed} de ${total.total} obrigatórios concluídos · ${total.rest} em descanso`
              : 'Sem hábitos obrigatórios programados'}
          </p>
        </div>
        <button
          data-new-habit
          className="button button-primary"
          disabled={busy}
          onClick={() => setSheet({ type: 'habit' })}
        >
          <Plus aria-hidden="true" />
          Novo hábito
        </button>
      </div>
      {data.habits.length ? (
        <div>
          {library ? (
            <HabitList
              habits={data.habits}
              logs={data.habitLogs}
              today={today}
              busy={busy}
              selected={selected}
              onSelect={setSelectedId}
              onRecord={(id) => record(today, id)}
              onToggle={(item, value) => void log(item.id, today, value, false)}
            />
          ) : (
            <ScheduledHabitList
              habits={data.habits}
              logs={data.habitLogs}
              today={today}
              busy={busy}
              selected={selected}
              onSelect={setSelectedId}
              onRecord={(id) => record(today, id)}
              onToggle={(item, value) => void log(item.id, today, value, false)}
            />
          )}
        </div>
      ) : (
        <div className="habits-empty">
          <h2>Sua constância começa aqui.</h2>
          <p>
            Crie um hábito simples ou acompanhe uma quantidade por dia. Comece
            com um só.
          </p>
        </div>
      )}
      {canUndo && (
        <div className="habit-undo">
          <span className="form-help">
            A última exclusão de hábito ou registro pode ser recuperada.
          </span>
          <button
            className="button"
            disabled={busy}
            onClick={() => void undo()}
          >
            Desfazer exclusão
          </button>
        </div>
      )}
      {data.habits.length > 0 && (
        <>
          <div className="history-controls">
            <label className="form-field">
              Histórico
              <select
                aria-label="Histórico"
                value={selected}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="all">Todos os hábitos</option>
                {data.habits.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Período
              <select
                aria-label="Período"
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
              >
                {[13, 26, 52].map((n) => (
                  <option value={n} key={n}>
                    {n} semanas
                  </option>
                ))}
              </select>
            </label>
            {habit && (
              <button
                className="button"
                disabled={busy}
                onClick={() => setSheet({ type: 'habit', habit })}
              >
                <Pencil aria-hidden="true" />
                Editar hábito
              </button>
            )}
            <button
              className="button"
              disabled={busy}
              onClick={() => record(today)}
            >
              Registrar outro dia
            </button>
          </div>
          {habit && streak && progress && (
            <div
              className="habit-stats"
              aria-label={`Resumo de ${habit.title}`}
            >
              <div>
                <strong>{streak.current}</strong>
                <span>
                  {streak.current === 1
                    ? streak.unit.slice(0, -1)
                    : streak.unit}{' '}
                  em sequência
                </span>
              </div>
              <div>
                <strong>{streak.best}</strong>
                <span>
                  maior sequência (
                  {streak.best === 1 ? streak.unit.slice(0, -1) : streak.unit})
                </span>
              </div>
              <div>
                <strong>
                  {progress.required === 0
                    ? '—'
                    : `${progress.completed}/${progress.required}`}
                </strong>
                <span>
                  {progress.required === 0
                    ? 'semana de descanso'
                    : 'dias nesta semana'}
                </span>
              </div>
              <p>
                {streak.unit !== 'semanas'
                  ? 'O dia de hoje fica aberto até meia-noite.'
                  : `Objetivo de ${habit.timesPerWeek}x por semana, de segunda a domingo. A semana atual ainda está aberta.`}{' '}
                Descansos preservam a sequência sem somar conclusões.
              </p>
            </div>
          )}
          <Heatmap
            key={`${selected}-${today}-${weeks}`}
            habits={data.habits}
            logs={data.habitLogs}
            habit={habit}
            today={day.today}
            weeks={weeks}
            onEdit={record}
          />
        </>
      )}
      {sheet?.type === 'habit' && (
        <HabitForm habit={sheet.habit} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === 'routine' && (
        <Suspense fallback={<p role="status">Abrindo configuração.</p>}>
          <RoutineImport onClose={() => setSheet(null)} />
        </Suspense>
      )}
      {sheet?.type === 'log' && (
        <LogForm
          initialHabitId={sheet.habitId}
          initialDate={sheet.date}
          onClose={() => setSheet(null)}
        />
      )}
      {!sheet && createPortal(<HabitFeedback />, document.body)}
    </div>
  )
}

function HabitFeedback() {
  const { error, message, canUndo, dismiss, undo } = useHabits()
  const busy = useData((s) => s.busy)
  if (!message && !error) return null
  return (
    <TransientToast
      identity={`${message}:${error}`}
      persistent={Boolean(error)}
      onDismiss={dismiss}
    >
      <p role={error ? 'alert' : 'status'}>{error ?? message}</p>
      <div className="button-row">
        {canUndo && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void undo()}
          >
            Desfazer
          </button>
        )}
        <button
          className="icon-button"
          aria-label="Fechar aviso de hábitos"
          onClick={dismiss}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </TransientToast>
  )
}
