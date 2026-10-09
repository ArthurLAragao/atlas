import { ConfirmAction } from '../../components/ConfirmAction'
import { useId, useState, type FormEvent } from 'react'
import { useData } from '../../app/data-store'
import { habitSchema, type Habit } from '../../data/models'
import { useHabits } from './habit-store'
import { HabitSheet } from './HabitSheet'
import { legacySchedule, withSchedule } from '../../lib/habit-schedule'
import { dateKey } from '../../lib/habits'
import type { HabitSchedule } from '../../data/routine-models'
import { ScheduleEditor } from './ScheduleEditor'

export function HabitForm({
  habit,
  onClose,
}: {
  habit?: Habit
  onClose: () => void
}) {
  const [title, setTitle] = useState(habit?.title ?? '')
  const [kind, setKind] = useState(habit?.kind ?? 'binary')
  const [target, setTarget] = useState(String(habit?.target ?? 1))
  const [unit, setUnit] = useState(habit?.unit ?? 'vez')
  const [schedule, setSchedule] = useState<HabitSchedule>(
    () =>
      habit?.scheduleVersions?.at(-1)?.schedule ??
      (habit
        ? legacySchedule(habit)
        : { mode: 'daily', timesPerWeek: 7, days: [] }),
  )
  const [tags, setTags] = useState(habit?.tags.join(', ') ?? '')
  const [error, setError] = useState('')
  const tagHelp = useId()
  const busy = useData((s) => s.busy)
  const hasLogs = useData((s) =>
    s.data.habitLogs.some((log) => log.habitId === habit?.id),
  )
  const save = useHabits((s) => s.save)
  const remove = useHabits((s) => s.remove)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const now = new Date().toISOString()
    const parsed = habitSchema.safeParse({
      id: habit?.id ?? crypto.randomUUID(),
      createdAt: habit?.createdAt ?? now,
      updatedAt: now,
      isExample: false,
      links: habit?.links ?? [],
      title,
      kind,
      target: kind === 'binary' ? 1 : Number(target.replace(',', '.')),
      unit: kind === 'binary' ? 'vez' : unit,
      timesPerWeek:
        schedule.mode === 'weekdays'
          ? Math.max(1, schedule.days.filter((d) => !d.optional).length)
          : schedule.timesPerWeek,
      ...(habit?.scheduleVersions
        ? { scheduleVersions: habit.scheduleVersions }
        : {}),
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean),
        ),
      ],
    })
    if (!parsed.success) {
      setError(
        'Preencha o nome, um alvo maior que zero, a unidade e até 50 tags de até 60 caracteres.',
      )
      return
    }
    const candidate = withSchedule(
      {
        ...parsed.data,
        scheduleVersions: habit
          ? (habit.scheduleVersions ?? [
              {
                effectiveFrom: '0001-01-01',
                schedule: legacySchedule(habit),
                target: habit.target,
                unit: habit.unit,
              },
            ])
          : [],
      },
      { ...schedule, timesPerWeek: parsed.data.timesPerWeek },
      dateKey(new Date()),
    )
    if (!habitSchema.safeParse(candidate).success) {
      setError(
        'Confira a programação: escolha ao menos um dia fixo e use horários, labels e ordem válidos.',
      )
      return
    }
    if (await save(candidate, habit?.updatedAt ?? null)) onClose()
    else
      setError(
        useHabits.getState().error ??
          'Não foi possível salvar. Tente novamente.',
      )
  }
  return (
    <HabitSheet
      title={habit ? 'Editar hábito' : 'Novo hábito'}
      description="Um pequeno compromisso, no seu ritmo."
      onClose={onClose}
    >
      <form
        className="habit-form"
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
      >
        <label className="form-field">
          Nome
          <input
            autoFocus
            required
            maxLength={240}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: ler por 15 minutos"
          />
        </label>
        <fieldset disabled={hasLogs}>
          <legend>Tipo</legend>
          <div className="segmented">
            {(['binary', 'quantity'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                <span>{value === 'binary' ? 'Simples' : 'Quantidade'}</span>
              </label>
            ))}
          </div>
          {hasLogs && (
            <p className="form-help">
              O tipo fica fixo após o primeiro registro.
            </p>
          )}
        </fieldset>
        {kind === 'quantity' && (
          <div className="form-columns">
            <label className="form-field">
              Alvo diário
              <input
                inputMode="decimal"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label className="form-field">
              Unidade
              <input
                required
                maxLength={40}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="min, L, páginas"
              />
            </label>
          </div>
        )}
        <ScheduleEditor value={schedule} onChange={setSchedule} />
        <div className="form-field">
          <label className="form-field">
            Tags
            <input
              aria-describedby={tagHelp}
              maxLength={3000}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="estudo, pessoal"
            />
          </label>
          <span id={tagHelp} className="form-help">
            Separe por vírgulas.
          </span>
        </div>
        {habit && (
          <p className="form-help">
            Alterações de alvo e programação valem a partir de hoje. O histórico
            anterior é preservado. Excluir remove também os registros deste
            hábito e permite desfazer.
          </p>
        )}
        {error && (
          <p role="alert" className="data-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
          >
            {habit ? 'Salvar hábito' : 'Criar hábito'}
          </button>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
        {habit && (
          <ConfirmAction
            name={habit.title}
            title="Excluir este hábito?"
            description="Esta ação remove o hábito e seus registros. Você poderá desfazer pelo aviso ou recuperar a última exclusão."
            className="button button-danger"
            type="button"
            disabled={busy}
            onConfirm={() =>
              void remove(habit.id).then((ok) => {
                if (ok) onClose()
                else
                  setError(
                    useHabits.getState().error ??
                      'Não foi possível excluir. Tente novamente.',
                  )
              })
            }
          >
            Excluir hábito
          </ConfirmAction>
        )}
      </form>
    </HabitSheet>
  )
}
