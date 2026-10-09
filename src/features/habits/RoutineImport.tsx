import { useRef, useState } from 'react'
import { HabitSheet } from './HabitSheet'
import { weekdayNames } from '../../data/routine-models'
import { useData, dataError } from '../../app/data-store'
import { repository } from '../../data/service'
import { parseRoutineConfig, routineFileLimit } from '../../lib/routine'
import { dateKey } from '../../lib/habits'
import type { Habit } from '../../data/models'
import type { RoutineConfig, RoutineMapping } from '../../data/routine-models'

export default function RoutineImport({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<RoutineConfig | null>(null)
  const [habits, setHabits] = useState<Habit[]>([])
  const [expectedRoutine, setExpectedRoutine] = useState<string | null>(null)
  const [mapping, setMapping] = useState<RoutineMapping[]>([])
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)
  const lock = useRef(false)
  const loadId = useRef(0)
  const busy = useData((s) => s.busy)
  async function load(file: File | undefined) {
    const request = ++loadId.current
    setError('')
    setConfig(null)
    setApplied(false)
    if (!file) return
    try {
      if (
        !file.name.toLowerCase().endsWith('.json') ||
        file.size > routineFileLimit
      )
        throw new Error('Selecione uma configuração JSON de até 1 MB.')
      const parsed = parseRoutineConfig(await file.text())
      if (request !== loadId.current) return
      const current = useData.getState().data
      setHabits(current.habits)
      setExpectedRoutine(current.routine?.updatedAt ?? null)
      setMapping(
        parsed.habits.map((h) => ({
          key: h.key,
          habitId: null,
          expectedUpdatedAt: null,
        })),
      )
      setConfig(parsed)
    } catch (e) {
      if (request !== loadId.current) return
      setError(dataError(e))
    }
  }
  async function apply() {
    if (!config || busy || lock.current) return
    lock.current = true
    useData.setState({ busy: true })
    try {
      const data = await repository.applyRoutine(
        config,
        mapping,
        expectedRoutine,
      )
      useData.setState({ data })
      setApplied(true)
    } catch (e) {
      setError(dataError(e))
    } finally {
      lock.current = false
      useData.setState({ busy: false })
    }
  }
  return (
    <HabitSheet
      title="Revisar rotina semanal"
      description="Configuração local. Nada é aplicado ao selecionar o arquivo."
      onClose={onClose}
    >
      <div className="habit-form">
        {!applied ? (
          <>
            <label className="form-field">
              Arquivo de rotina
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => void load(e.target.files?.[0])}
              />
            </label>
            <p className="form-help">
              Até 1 MB. Processado no navegador. Nenhum hábito ou registro
              existente é apagado; títulos parecidos não são fundidos.
            </p>
            {config && (
              <>
                <details open>
                  <summary>Resumo dos sete dias</summary>
                  {config.days.map((day) => (
                    <section key={day.weekday} className="routine-import-day">
                      <h3>
                        {weekdayNames[day.weekday]} · {day.type}
                      </h3>
                      <p>{day.focus}</p>
                      <ul>
                        {day.classes.map((c, i) => (
                          <li key={i}>
                            {c.start}–{c.end} · {c.title}
                          </li>
                        ))}
                      </ul>
                      <details>
                        <summary>Planejamento de referência</summary>
                        <ul>
                          {day.planning.map((b, i) => (
                            <li key={i}>
                              {b.start ?? 'Sem horário fixo'}
                              {b.end ? `–${b.end}` : ''}
                              {b.dayOffset ? ' · dia seguinte' : ''} · {b.title}
                              {b.optional ? ' · Opcional' : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </section>
                  ))}
                </details>
                <h3>Associar históricos</h3>
                {config.habits.map((h) => (
                  <div key={h.key} className="routine-import-day">
                    <label className="form-field">
                      Histórico para {h.title}
                      <select
                        value={
                          mapping.find((m) => m.key === h.key)?.habitId ?? ''
                        }
                        disabled={busy}
                        onChange={(e) => {
                          const old = habits.find(
                            (v) => v.id === e.target.value,
                          )
                          setMapping(
                            mapping.map((m) =>
                              m.key === h.key
                                ? {
                                    ...m,
                                    habitId: old?.id ?? null,
                                    expectedUpdatedAt: old?.updatedAt ?? null,
                                  }
                                : m,
                            ),
                          )
                        }}
                      >
                        <option value="">Criar novo hábito</option>
                        {habits
                          .filter(
                            (v) =>
                              v.kind === h.kind &&
                              (v.kind === 'binary' || v.unit === h.unit),
                          )
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title} · ID {v.id}
                            </option>
                          ))}
                      </select>
                    </label>
                    <p className="form-help">
                      {h.kind === 'binary'
                        ? 'Marcação manual'
                        : `${h.target} ${h.unit}`}{' '}
                      ·{' '}
                      {h.schedule.mode === 'weekdays'
                        ? 'Dias fixos'
                        : h.schedule.mode === 'daily'
                          ? 'Todos os dias'
                          : `${h.schedule.timesPerWeek}x por semana`}
                    </p>
                    <ul>
                      {h.schedule.days.map((d) => (
                        <li key={d.weekday}>
                          {weekdayNames[d.weekday]} · {d.label ?? h.title} ·{' '}
                          {d.time ?? 'Ao longo do dia'}
                          {d.dayOffset ? ' · dia seguinte' : ''}
                          {d.optional ? ' · Opcional' : ''} · ordem {d.order}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="form-help">
                  Vigência: {dateKey(new Date())}. A rotina anterior e os
                  registros de datas passadas serão preservados. Selecionar
                  “Criar novo” novamente cria outro histórico; revise os IDs
                  antes de confirmar.
                </p>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void apply()}
                >
                  Confirmar e aplicar rotina
                </button>
              </>
            )}
          </>
        ) : (
          <p role="status">
            Rotina aplicada neste navegador. Hábitos e históricos anteriores
            preservados. Você pode conferir Hoje e a biblioteca de Hábitos.
          </p>
        )}
        {error && (
          <p className="data-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy} onClick={onClose}>
          {applied ? 'Concluir' : 'Cancelar'}
        </button>
      </div>
    </HabitSheet>
  )
}
