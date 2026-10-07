import { DateField } from '../../components/DateField'
import { useRef, useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { goalSchema, type Goal } from '../../data/models'
import { readNoteTags } from '../../lib/note-tags'
import { useDirections } from './direction-store'
import { useActiveForm } from './use-active-form'

type ResultDraft = {
  id: string
  title: string
  current: string
  target: string
  unit: string
}
const numeric = (value: string) =>
  value.trim() ? Number(value.replace(',', '.')) : NaN
export function GoalForm({
  goal,
  onClose,
  onSaved,
}: {
  goal?: Goal
  onClose: () => void
  onSaved: (goal: Goal) => void
}) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [tags, setTags] = useState(goal?.tags.join(', ') ?? '')
  const [status, setStatus] = useState(
    goal?.status === 'completed' ? 'completed' : 'active',
  )
  const [weekly, setWeekly] = useState(goal?.weekly ?? false)
  const [results, setResults] = useState<ResultDraft[]>(
    () =>
      goal?.keyResults.map((result) => ({
        ...result,
        current: String(result.current),
        target: String(result.target),
        unit: result.unit ?? '',
      })) ?? [],
  )
  const [error, setError] = useState('')
  const busy = useData((state) => state.busy)
  const submitRef = useRef<HTMLButtonElement>(null)
  const active = useActiveForm()
  function addResult() {
    const id = crypto.randomUUID()
    setResults((current) => [
      ...current,
      { id, title: '', current: '0', target: '1', unit: '' },
    ])
    requestAnimationFrame(() =>
      document.getElementById(`result-${id}`)?.focus(),
    )
  }
  function update(
    id: string,
    field: keyof Omit<ResultDraft, 'id'>,
    value: string,
  ) {
    setResults((current) =>
      current.map((result) =>
        result.id === id ? { ...result, [field]: value } : result,
      ),
    )
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const now = new Date().toISOString()
    const parsed = goalSchema.safeParse({
      ...goal,
      id: goal?.id ?? crypto.randomUUID(),
      title,
      description,
      deadline: deadline || null,
      status,
      weekly,
      tags: readNoteTags(tags, goal?.tags ?? []),
      links: goal?.links ?? [],
      keyResults: results.map((result) => ({
        ...result,
        current: numeric(result.current),
        target: numeric(result.target),
      })),
      createdAt: goal?.createdAt ?? now,
      updatedAt: goal?.updatedAt ?? now,
      isExample: false,
    })
    if (!parsed.success) {
      setError(
        'Confira os resultados: valor atual deve ser zero ou maior; alvo deve ser maior que zero. Use títulos de até 240 caracteres e até 50 tags de 60 caracteres.',
      )
      return
    }
    const saved = await useDirections
      .getState()
      .saveGoal(parsed.data, goal?.updatedAt ?? null)
    if (!active.current) return
    if (saved) onSaved(saved)
    else
      setError(
        useDirections.getState().error ??
          'Não foi possível salvar. Confira os campos e tente novamente.',
      )
  }
  return (
    <EntrySheet
      title={goal ? 'Editar meta' : 'Nova meta'}
      description="Dê um nome à intenção e escolha como reconhecer o progresso."
      onClose={onClose}
    >
      <form
        className="direction-form"
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
      >
        <label>
          Título da meta
          <input
            autoFocus
            required
            value={title}
            maxLength={240}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="direction-fields">
          <label>
            Prazo da meta
            <DateField
              label="Prazo da meta"
              value={deadline}
              disabled={busy}
              onValueChange={setDeadline}
            />
          </label>
          <label>
            Estado da meta
            <select
              value={status}
              disabled={busy}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="active">Ativa</option>
              <option value="completed">Concluída</option>
            </select>
          </label>
        </div>
        <label className="direction-check">
          <input
            type="checkbox"
            checked={weekly}
            disabled={busy}
            onChange={(event) => setWeekly(event.target.checked)}
          />
          Definir como meta da semana
        </label>
        <p className="form-help">
          Hoje mostra esta escolha até você trocar ou retirar a seleção. Apenas
          uma meta por vez.
        </p>
        <fieldset className="direction-results">
          <legend>Resultados-chave</legend>
          <p className="form-help">
            Medidas manuais, independentes das tarefas. Você pode começar sem
            elas.
          </p>
          {results.map((result, index) => (
            <div className="direction-result-fields" key={result.id}>
              <label>
                Título do resultado {index + 1}
                <input
                  id={`result-${result.id}`}
                  required
                  value={result.title}
                  maxLength={240}
                  disabled={busy}
                  onChange={(event) =>
                    update(result.id, 'title', event.target.value)
                  }
                />
              </label>
              <div className="direction-fields">
                <label>
                  Valor atual {index + 1}
                  <input
                    inputMode="decimal"
                    required
                    value={result.current}
                    disabled={busy}
                    onChange={(event) =>
                      update(result.id, 'current', event.target.value)
                    }
                  />
                </label>
                <label>
                  Valor-alvo {index + 1}
                  <input
                    inputMode="decimal"
                    required
                    value={result.target}
                    disabled={busy}
                    onChange={(event) =>
                      update(result.id, 'target', event.target.value)
                    }
                  />
                </label>
              </div>
              <label>
                Unidade {index + 1}
                <input
                  placeholder="módulos, horas…"
                  maxLength={40}
                  value={result.unit}
                  disabled={busy}
                  onChange={(event) =>
                    update(result.id, 'unit', event.target.value)
                  }
                />
              </label>
              <button
                className="button"
                type="button"
                disabled={busy}
                aria-label={`Remover resultado ${index + 1}`}
                onClick={() => {
                  setResults((current) =>
                    current.filter((item) => item.id !== result.id),
                  )
                  requestAnimationFrame(() => submitRef.current?.focus())
                }}
              >
                Remover resultado
              </button>
            </div>
          ))}
          <button
            className="button"
            type="button"
            disabled={busy || results.length >= 100}
            onClick={addResult}
          >
            Adicionar resultado-chave
          </button>
        </fieldset>
        <details>
          <summary>Descrição e tags</summary>
          <div className="direction-form">
            <label>
              Descrição da meta
              <textarea
                value={description}
                maxLength={50_000}
                disabled={busy}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label>
              Tags da meta
              <input
                value={tags}
                maxLength={4000}
                disabled={busy}
                placeholder="estudos, cloud"
                onChange={(event) => setTags(event.target.value)}
              />
            </label>
          </div>
        </details>
        {error && (
          <p className="data-error" role="alert">
            {error} Seu texto continua no formulário.
          </p>
        )}
        <div className="direction-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            ref={submitRef}
            className="button button-primary"
            disabled={busy || !title.trim()}
          >
            Salvar meta
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
