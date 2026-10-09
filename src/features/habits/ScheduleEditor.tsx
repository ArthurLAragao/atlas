import type { HabitSchedule, ScheduleDay } from '../../data/routine-models'

import { weekdayNames } from '../../data/routine-models'
export function ScheduleEditor({
  value,
  onChange,
}: {
  value: HabitSchedule
  onChange: (value: HabitSchedule) => void
}) {
  function update(weekday: number, patch: Partial<ScheduleDay>) {
    const day = value.days.find((d) => d.weekday === weekday) ?? {
      weekday,
      time: null,
      dayOffset: 0,
      order: weekday,
      optional: false,
    }
    onChange({
      ...value,
      days: [
        ...value.days.filter((d) => d.weekday !== weekday),
        { ...day, ...patch },
      ].sort((a, b) => a.weekday - b.weekday),
    })
  }
  return (
    <fieldset>
      <legend>Programação</legend>
      <label className="form-field">
        Dias programados
        <select
          aria-label="Dias programados"
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value as HabitSchedule['mode']
            onChange({
              ...value,
              mode,
              timesPerWeek: mode === 'daily' ? 7 : value.timesPerWeek,
              days:
                mode === 'weekdays' && !value.days.length
                  ? [
                      {
                        weekday: 1,
                        time: null,
                        dayOffset: 0,
                        order: 0,
                        optional: false,
                      },
                    ]
                  : value.days,
            })
          }}
        >
          <option value="daily">Todos os dias</option>
          <option value="weekdays">Dias específicos</option>
          <option value="flexible">Frequência flexível por semana</option>
        </select>
      </label>
      {value.mode !== 'weekdays' && (
        <label className="form-field">
          Frequência
          <select
            aria-label="Frequência"
            value={value.timesPerWeek}
            onChange={(e) =>
              onChange({
                ...value,
                timesPerWeek: Number(e.target.value),
                mode: Number(e.target.value) === 7 ? 'daily' : 'flexible',
              })
            }
          >
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? 'Todos os dias' : `${n}x por semana`}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="form-help">
        Dias fixos contam ocorrências previstas. Frequência flexível conta
        semanas, sem exigir dias específicos. Alterações valem a partir de hoje.
      </p>
      {
        <details>
          <summary>Dias, horários e variações</summary>
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
            const day = value.days.find((d) => d.weekday === weekday)
            return (
              <fieldset key={weekday} className="routine-day-fields">
                <legend>{weekdayNames[weekday]}</legend>
                {value.mode === 'weekdays' && (
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(day)}
                      onChange={(e) => {
                        if (e.target.checked) update(weekday, {})
                        else
                          onChange({
                            ...value,
                            days: value.days.filter(
                              (d) => d.weekday !== weekday,
                            ),
                          })
                      }}
                    />
                    Programar {weekdayNames[weekday]}
                  </label>
                )}
                {(value.mode !== 'weekdays' || day) && (
                  <>
                    <label className="form-field">
                      Label · {weekdayNames[weekday]}
                      <input
                        maxLength={240}
                        value={day?.label ?? ''}
                        placeholder="Usar o nome do hábito"
                        onChange={(e) =>
                          update(weekday, {
                            label: e.target.value.trim()
                              ? e.target.value
                              : undefined,
                          })
                        }
                      />
                    </label>
                    <div className="form-columns">
                      <label className="form-field">
                        Horário · {weekdayNames[weekday]}
                        <input
                          type="time"
                          value={day?.time ?? ''}
                          onChange={(e) =>
                            update(weekday, { time: e.target.value || null })
                          }
                        />
                      </label>
                      <label className="form-field">
                        Dia do horário · {weekdayNames[weekday]}
                        <select
                          value={day?.dayOffset ?? 0}
                          onChange={(e) =>
                            update(weekday, {
                              dayOffset: Number(e.target.value),
                            })
                          }
                        >
                          <option value={0}>Na mesma data</option>
                          <option value={1}>Na madrugada seguinte</option>
                        </select>
                      </label>
                      <label className="form-field">
                        Ordem · {weekdayNames[weekday]}
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={day?.order ?? 0}
                          onChange={(e) =>
                            update(weekday, { order: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={day?.optional ?? false}
                        onChange={(e) =>
                          update(weekday, { optional: e.target.checked })
                        }
                      />
                      Opcional · {weekdayNames[weekday]}
                    </label>
                  </>
                )}
              </fieldset>
            )
          })}
        </details>
      }
    </fieldset>
  )
}
