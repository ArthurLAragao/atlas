import { useData } from '../../app/data-store'
import { usePreferences } from '../../app/preferences-store'
import { experienceSummary } from '../../lib/experience'
export function ExperienceSummary() {
  const events = useData((state) => state.data.experience)
  const visible = usePreferences((state) => state.preferences.showXp)
  const summary = experienceSummary(events)
  return (
    <section aria-labelledby="preferences-experience">
      <h2 id="preferences-experience">Pequenos passos</h2>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) =>
            usePreferences.getState().update({ showXp: event.target.checked })
          }
        />
        <span>Mostrar resumo de XP</span>
      </label>
      <p className="caption">
        Um registro discreto do seu esforço. Sem perdas por ausência ou
        sequência; não altera metas, notas ou progresso.
      </p>
      {visible && (
        <p className="tabular" data-experience-summary>
          {summary.total} XP · {summary.actions} ações registradas ·{' '}
          {summary.milestone}
        </p>
      )}
    </section>
  )
}
