import { SelectMenu } from '../../components/SelectMenu'
import { useState } from 'react'
import { taskSchema, type Task } from '../../data/models'
import { parseTaskInput } from '../../lib/task-parser'
import { formatTaskDate, taskPriorityLabels } from '../../lib/tasks'
import { usePreferences } from '../../app/preferences-store'
import { CompactCapture } from '../../components/CompactCapture'
import { useTasks } from './task-store'
import '../../styles/capture.css'

export function QuickTask({ busy }: { busy: boolean }) {
  const [value, setValue] = useState(''),
    [error, setError] = useState('')
  const [context, setContext] = useState(''),
    [repeat, setRepeat] = useState('')
  const contexts = usePreferences((s) => s.preferences.contexts)
  const parsed = parseTaskInput(value, new Date())
  const recognized =
    parsed.dueDate ||
    parsed.dueTime ||
    parsed.tags.length ||
    /![a-záéíóú]+/iu.test(value) ||
    context ||
    repeat
  async function submit() {
    const now = new Date().toISOString()
    const task: Task = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      links: [],
      isExample: false,
      title: parsed.title,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      tags: parsed.tags,
      priority: parsed.priority,
      status: 'todo',
      context: context || null,
      subtasks: [],
      repeat: repeat
        ? { unit: repeat as 'day' | 'week' | 'month', interval: 1 }
        : null,
      focusMinutes: 0,
    }
    if (!taskSchema.safeParse(task).success) {
      setError(
        'Digite um nome para a tarefa, com até 240 caracteres. Revise as tags se necessário.',
      )
      return false
    }
    if (await useTasks.getState().save(task)) {
      setValue('')
      setContext('')
      setRepeat('')
      setError('')
      return true
    }
    setError(useTasks.getState().error ?? 'Tente criar novamente.')
    return false
  }
  return (
    <CompactCapture
      label="Captura rápida"
      placeholder="Adicionar tarefa…"
      expandedPlaceholder="Adicionar tarefa… ex.: estudar AWS amanhã 19h #faculdade !alta"
      hint="Use #tags, !prioridade e datas"
      value={value}
      onChange={(value) => {
        setValue(value)
        setError('')
      }}
      onCreate={submit}
      busy={busy}
    >
      {value.trim() && recognized && (
        <div
          className="quick-task-preview"
          aria-label="Interpretação da captura"
        >
          <strong>{parsed.title || 'Falta o nome da tarefa'}</strong>
          <span>
            {parsed.dueDate ? formatTaskDate(parsed.dueDate) : 'Sem prazo'}
            {parsed.dueTime ? ` · ${parsed.dueTime}` : ''} ·{' '}
            {taskPriorityLabels[parsed.priority]}
            {parsed.tags.length
              ? ` · ${parsed.tags.map((t) => `#${t}`).join(' ')}`
              : ''}
            {context ? ` · ${context}` : ''}
            {repeat
              ? ` · Repete: ${repeat === 'day' ? 'diariamente' : repeat === 'week' ? 'semanalmente' : 'mensalmente'}`
              : ''}
          </span>
        </div>
      )}
      <div className="capture-options">
        <label className="task-field">
          Contexto da captura
          <SelectMenu
            label="Contexto da captura"
            value={context}
            onChange={setContext}
            disabled={busy}
            options={[
              { value: '', label: 'Sem contexto' },
              ...contexts.map((value) => ({ value, label: value })),
            ]}
          />
        </label>
        <label className="task-field">
          Repetição da captura
          <SelectMenu
            label="Repetição da captura"
            value={repeat}
            onChange={setRepeat}
            disabled={busy}
            options={[
              { value: '', label: 'Não repete' },
              { value: 'day', label: 'Diariamente' },
              { value: 'week', label: 'Semanalmente' },
              { value: 'month', label: 'Mensalmente' },
            ]}
          />
        </label>
      </div>
      <details className="capture-help">
        <summary>Ajuda de sintaxe</summary>
        <p className="task-help">
          Enter cria. Shift+Enter mantém o campo. Use hoje, amanhã, sexta ou
          15/10; 19h; #tag; !alta, !média ou !baixa. Contexto e repetição são
          escolhas explícitas acima.
        </p>
      </details>
      {parsed.warnings.map((w) => (
        <p className="task-help" key={w}>
          {w}
        </p>
      ))}
      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
    </CompactCapture>
  )
}
