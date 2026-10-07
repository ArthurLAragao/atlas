import { ConfirmAction } from '../../components/ConfirmAction'
import { useId, useState, type FormEvent } from 'react'
import { useData } from '../../app/data-store'
import { habitSchema, type Habit } from '../../data/models'
import { useHabits } from './habit-store'
import { HabitSheet } from './HabitSheet'

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
  const [frequency, setFrequency] = useState(habit?.timesPerWeek ?? 7)
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
      timesPerWeek: frequency,
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
    if (await save(parsed.data, habit?.updatedAt ?? null)) onClose()
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
        <label className="form-field">
          Frequência
          <select
            aria-label="Frequência"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? 'Todos os dias' : `${n}x por semana`}
              </option>
            ))}
          </select>
        </label>
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
            Alterar o alvo ou a frequência recalcula as sequências do histórico.
            Excluir remove também os registros deste hábito e permite desfazer.
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
