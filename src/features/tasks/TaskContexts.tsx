import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { usePreferences } from '../../app/preferences-store'

export function TaskContexts({ onClose }: { onClose: () => void }) {
  const contexts = usePreferences((state) => state.preferences.contexts)
  const update = usePreferences((state) => state.update)
  const [text, setText] = useState(contexts.join('\n'))
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const values = [
      ...new Set(
        text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ]
    if (values.length > 50 || values.some((value) => value.length > 80)) {
      setError('Use até 50 contextos, com até 80 caracteres cada.')
      return
    }
    update({ contexts: values })
    if (usePreferences.getState().storageFailed) {
      setError(
        'O navegador bloqueou a gravação. As sugestões valem nesta sessão; permita o armazenamento para guardá-las.',
      )
      return
    }
    onClose()
  }
  return (
    <EntrySheet
      title="Editar contextos"
      description="Sugestões para separar estudo, trabalho e vida pessoal."
      onClose={onClose}
    >
      <form className="task-form" onSubmit={submit}>
        <label className="task-field">
          Um contexto por linha
          <textarea
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <p className="task-help">
          Alterar sugestões preserva os contextos das tarefas existentes. Você
          também pode digitar um novo contexto na tarefa.
        </p>
        {error && (
          <p role="alert" className="task-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="button task-primary">Salvar contextos</button>
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
