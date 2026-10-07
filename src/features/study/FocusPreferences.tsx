import { useState } from 'react'
import { usePreferences } from '../../app/preferences-store'
import { Field, number } from './StudyForm'

export function FocusPreferences() {
  const preferences = usePreferences((state) => state.preferences)
  const update = usePreferences((state) => state.update)
  const storageFailed = usePreferences((state) => state.storageFailed)
  const [message, setMessage] = useState('')
  return (
    <details className="direction-section">
      <summary>Preferências de duração</summary>
      <form
        className="direction-form"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const focusMinutes = number(data, 'focusMinutes'),
            shortBreakMinutes = number(data, 'shortBreakMinutes'),
            longBreakMinutes = number(data, 'longBreakMinutes')
          if (
            !focusMinutes ||
            !shortBreakMinutes ||
            !longBreakMinutes ||
            ![focusMinutes, shortBreakMinutes, longBreakMinutes].every(
              Number.isInteger,
            ) ||
            focusMinutes > 180 ||
            shortBreakMinutes > 60 ||
            longBreakMinutes > 120
          ) {
            setMessage('Use minutos inteiros dentro dos limites indicados.')
            return
          }
          update({ focusMinutes, shortBreakMinutes, longBreakMinutes })
          setMessage('Durações atualizadas para a próxima sessão.')
        }}
      >
        <p className="direction-help">
          A sessão atual mantém sua duração. As novas durações valem para a
          próxima sessão.
        </p>
        <Field
          label="Foco em minutos"
          name="focusMinutes"
          type="number"
          value={preferences.focusMinutes}
          min={1}
          max={180}
          required
        />
        <Field
          label="Pausa curta em minutos"
          name="shortBreakMinutes"
          type="number"
          value={preferences.shortBreakMinutes}
          min={1}
          max={60}
          required
        />
        <Field
          label="Pausa longa em minutos"
          name="longBreakMinutes"
          type="number"
          value={preferences.longBreakMinutes}
          min={1}
          max={120}
          required
        />
        <button className="button">Salvar durações</button>
        {message && (
          <p role="status">
            {storageFailed
              ? 'O navegador bloqueou o salvamento das preferências. Permita o armazenamento local.'
              : message}
          </p>
        )}
      </form>
    </details>
  )
}
