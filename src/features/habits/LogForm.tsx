import { ConfirmAction } from '../../components/ConfirmAction'
import { DateField } from '../../components/DateField'
import { useId, useState, type FormEvent } from 'react'
import { useData } from '../../app/data-store'
import { dateKey, formatDay } from '../../lib/habits'
import { scheduledDay } from '../../lib/habit-schedule'
import { useHabits } from './habit-store'
import { HabitSheet } from './HabitSheet'

export function LogForm({
  initialHabitId,
  initialDate,
  onClose,
}: {
  initialHabitId: string
  initialDate: string
  onClose: () => void
}) {
  const data = useData((s) => s.data)
  const [habitId, setHabitId] = useState(initialHabitId)
  const [date, setDate] = useState(initialDate)
  const habit = data.habits.find((item) => item.id === habitId)
  const existing = data.habitLogs.find(
    (item) => item.habitId === habitId && item.date === date,
  )
  // Remount fields on habit/date changes so edits never leak to a different day.
  return (
    <HabitSheet
      title="Registrar dia"
      description="Atualize a quantidade ou reserve um dia de descanso."
      onClose={onClose}
    >
      <div className="habit-form">
        <label className="form-field">
          Hábito
          <select
            aria-label="Hábito"
            value={habitId}
            onChange={(e) => setHabitId(e.target.value)}
          >
            {data.habits.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Data
          <DateField
            label="Data"
            required
            max={dateKey(new Date())}
            value={date}
            onValueChange={setDate}
          />
        </label>
        {habit ? (
          <LogFields
            key={`${habitId}-${date}`}
            habitId={habitId}
            date={date}
            onClose={onClose}
            initialValue={existing?.value ?? 0}
            initialRest={existing?.rest ?? false}
            initialVersion={existing?.updatedAt ?? null}
          />
        ) : (
          <p>Este hábito foi removido. Feche e escolha outro.</p>
        )}
      </div>
    </HabitSheet>
  )
}

function LogFields({
  habitId,
  date,
  initialValue,
  initialRest,
  initialVersion,
  onClose,
}: {
  habitId: string
  date: string
  initialValue: number
  initialRest: boolean
  initialVersion: string | null
  onClose: () => void
}) {
  const habit = useData((s) =>
    s.data.habits.find((item) => item.id === habitId),
  )!
  const existing = useData((s) =>
    s.data.habitLogs.some(
      (item) => item.habitId === habitId && item.date === date,
    ),
  )
  const busy = useData((s) => s.busy)
  const [value, setValue] = useState(String(initialValue))
  const [rest, setRest] = useState(initialRest)
  const [version] = useState(initialVersion)
  const [error, setError] = useState('')
  const quantityHelp = useId()
  const plan = scheduledDay(habit, date)
  const log = useHabits((s) => s.log)
  const removeLog = useHabits((s) => s.removeLog)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = rest ? 0 : Number(value.replace(',', '.'))
    if (
      !date ||
      date > dateKey(new Date()) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (!rest && !value.trim())
    ) {
      setError(
        'Escolha uma data até hoje e uma quantidade igual ou maior que zero.',
      )
      return
    }
    if (await log(habitId, date, amount, rest, version)) onClose()
    else
      setError(
        useHabits.getState().error ??
          'Não foi possível salvar. Tente novamente.',
      )
  }
  return (
    <form
      className="habit-form"
      aria-busy={busy}
      onSubmit={(e) => void submit(e)}
    >
      <p className="form-help">
        Atribuição: {formatDay(date)} · {plan.label}.{' '}
        {plan.dayOffset === 1
          ? 'Horário da madrugada seguinte; o registro pertence à data acima.'
          : ''}
      </p>
      {habit.kind === 'binary' ? (
        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={rest}
            checked={value === '1' && !rest}
            onChange={(e) => setValue(e.target.checked ? '1' : '0')}
          />
          Concluído
        </label>
      ) : (
        <div className="form-field">
          <label className="form-field">
            Quantidade ({plan.unit})
            <input
              aria-describedby={quantityHelp}
              inputMode="decimal"
              disabled={rest}
              required={!rest}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <span id={quantityHelp} className="form-help">
            Alvo: {plan.target.toLocaleString('pt-BR')} {plan.unit}.
          </span>
        </div>
      )}
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={rest}
          onChange={(e) => setRest(e.target.checked)}
        />
        Descanso
      </label>
      <p className="form-help">
        Descanso preserva a sequência e não conta como conclusão. Salvar
        descanso substitui a quantidade deste dia por zero.
      </p>
      {error && (
        <p className="data-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button className="button button-primary" disabled={busy}>
          Salvar registro
        </button>
        <button
          className="button"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
      </div>
      {existing && (
        <ConfirmAction
          className="button button-danger"
          title="Apagar este registro de hábito?"
          name={`${habit.title} · ${date}`}
          disabled={busy}
          onConfirm={() =>
            removeLog(habitId, date).then((ok) => {
              if (ok) onClose()
              else
                setError(
                  useHabits.getState().error ??
                    'Não foi possível excluir. Tente novamente.',
                )
            })
          }
        >
          Apagar registro
        </ConfirmAction>
      )}
    </form>
  )
}
