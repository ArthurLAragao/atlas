import { SelectMenu } from '../../components/SelectMenu'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useData } from '../../app/data-store'
import { usePreferences } from '../../app/preferences-store'
import { PageHeader } from '../../components/PageHeader'
import { EntrySheet } from '../../components/EntrySheet'
import { repository } from '../../data/service'
import type { FocusSession } from '../../data/models'
import {
  elapsedFocusMs,
  focusClock,
  focusModeLabels,
  remainingFocusSeconds,
  type FocusMode,
} from '../../lib/focus'
import {
  learningChange,
  refreshLearningUndo,
  useLearning,
} from './learning-store'
import { FocusPreferences } from './FocusPreferences'
import { FocusHistory } from './FocusHistory'
import '../../styles/directions.css'
import '../../styles/study.css'

export default function FocusPage() {
  const [params] = useSearchParams()
  return (
    <FocusView
      key={params.get('task') ?? 'global'}
      initialTask={params.get('task') ?? ''}
    />
  )
}
function FocusView({ initialTask }: { initialTask: string }) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const status = useData((state) => state.status)
  const preferences = usePreferences((state) => state.preferences)
  const error = useLearning((state) => state.error)
  const message = useLearning((state) => state.message)
  const canUndo = useLearning((state) => state.canUndoFocus)
  const [mode, setMode] = useState<FocusMode>('focus')
  const [taskId, setTaskId] = useState(initialTask)
  const [context, setContext] = useState('')
  const [now, setNow] = useState(Date.now)
  const [confirm, setConfirm] = useState(false)
  const startButton = useRef<HTMLButtonElement>(null)
  const active = data.focusSessions.find(
    (session) => session.status === 'in-progress',
  )
  const chosenMode = active?.mode ?? mode
  const plannedSeconds =
    (mode === 'focus'
      ? preferences.focusMinutes
      : mode === 'shortBreak'
        ? preferences.shortBreakMinutes
        : preferences.longBreakMinutes) * 60
  const remaining = active ? remainingFocusSeconds(active, now) : plannedSeconds
  const ended = Boolean(active && remaining === 0)
  const running = active?.timerState === 'running' && !ended
  const liveStatus = active
    ? ended
      ? 'Tempo encerrado. Confirme a conclusão quando estiver pronto.'
      : running
        ? 'Sessão em andamento.'
        : 'Sessão pausada.'
    : 'Pronto para começar.'
  useEffect(() => {
    useLearning.setState({ error: '', message: '' })
    void refreshLearningUndo()
  }, [])
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 250)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  async function start() {
    if (busy || status !== 'ready') return
    const links: FocusSession['links'] = []
    if (context) {
      const [type, id] = context.split(':')
      if (
        id &&
        (type === 'projects' || type === 'subjects' || type === 'studyPaths')
      )
        links.push({ type, id })
    }
    await learningChange(
      () =>
        repository.startFocus({
          id: crypto.randomUUID(),
          mode,
          plannedSeconds,
          taskId: taskId || null,
          links,
        }),
      'Sessão iniciada.',
    )
    setNow(() => Date.now())
  }
  async function toggle() {
    if (!active) return start()
    if (ended) return
    await learningChange(
      () =>
        repository.changeFocus(
          active.id,
          running ? 'pause' : 'resume',
          active.updatedAt,
        ),
      running ? 'Sessão pausada.' : 'Sessão retomada.',
    )
    setNow(() => Date.now())
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      )
        return
      if (event.code === 'Space') {
        if (
          event.target instanceof Element &&
          event.target.closest('button, a, summary')
        )
          return
        event.preventDefault()
        void toggle()
      }
      if (event.key === 'Escape' && active) {
        event.preventDefault()
        setConfirm(true)
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  })
  async function finish(action: 'complete' | 'interrupt', reset = false) {
    if (!active) return
    const ok = await learningChange(
      () => repository.changeFocus(active.id, action, active.updatedAt),
      action === 'complete'
        ? 'Sessão concluída e tempo registrado.'
        : 'Sessão interrompida. O tempo realizado foi registrado.',
    )
    if (ok) {
      if (reset) {
        setMode(active.mode)
        setTaskId(active.taskId ?? '')
        const related = active.links[0]
        setContext(related ? `${related.type}:${related.id}` : '')
      }
      setConfirm(false)
      requestAnimationFrame(() => startButton.current?.focus())
    }
  }
  function undoTaskLink() {
    const heading = document.querySelector<HTMLElement>(
      '[data-focus-history-heading]',
    )
    void learningChange(
      () => repository.undoFocusTask(),
      'Vínculo e minutos da tarefa recuperados.',
    ).then((ok) => {
      if (ok)
        requestAnimationFrame(() => {
          if (heading?.isConnected) heading.focus()
        })
    })
  }
  return (
    <div className="directions-page focus-page">
      <PageHeader title="Foco" eyebrow="Uma coisa de cada vez">
        Reserve um tempo para um próximo passo possível.
      </PageHeader>
      {error && (
        <p role="alert" className="data-error">
          {error}
        </p>
      )}
      {!error && message && <p className="direction-help">{message}</p>}
      {canUndo && (
        <button className="button" disabled={busy} onClick={undoTaskLink}>
          Desfazer desvinculação da tarefa
        </button>
      )}
      <section className="focus-stage" aria-label="Cronômetro de foco">
        <p className="eyebrow">{focusModeLabels[chosenMode]}</p>
        <h2>
          {active?.title ??
            data.tasks.find((task) => task.id === taskId)?.title ??
            'Seu próximo passo'}
        </h2>
        <div
          className="focus-clock"
          role="timer"
          aria-live="off"
          aria-label={`Tempo restante: ${Math.floor(remaining / 60)} minutos e ${remaining % 60} segundos`}
        >
          {focusClock(remaining)}
        </div>
        <p role="status">{liveStatus}</p>
        {active?.taskId && (
          <Link
            className="direction-external"
            to={`/tarefas?task=${encodeURIComponent(active.taskId)}`}
          >
            Abrir tarefa vinculada
          </Link>
        )}
        <div className="direction-actions focus-controls">
          <button
            ref={startButton}
            className="button button-primary"
            disabled={busy || ended || status !== 'ready'}
            onClick={() => void toggle()}
          >
            {running ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {active ? (running ? 'Pausar' : 'Retomar') : 'Iniciar'}
          </button>
          {active && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => void finish('interrupt', true)}
              >
                <RotateCcw aria-hidden="true" />
                Reiniciar
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                <Square aria-hidden="true" />
                Encerrar
              </button>
            </>
          )}
        </div>
        <p className="direction-help">
          Space inicia ou pausa. Escape abre a confirmação para encerrar. Ao
          sair, a sessão permanece em andamento; você decide quando encerrar.
        </p>
      </section>
      {!active && (
        <form
          className="direction-form focus-setup"
          onSubmit={(event) => {
            event.preventDefault()
            void start()
          }}
        >
          <fieldset className="segmented focus-modes">
            <legend>Modo</legend>
            {Object.entries(focusModeLabels).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="focus-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value as FocusMode)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label>
            Tarefa vinculada
            <SelectMenu
              label="Tarefa vinculada"
              value={taskId}
              onChange={setTaskId}
              options={[
                { value: '', label: 'Sem tarefa' },
                ...data.tasks.map((task) => ({
                  value: task.id,
                  label: task.title,
                })),
              ]}
            />
          </label>
          <details>
            <summary>Contexto adicional (opcional)</summary>
            <label>
              Projeto, disciplina ou trilha
              <select
                value={context}
                onChange={(event) => setContext(event.target.value)}
              >
                <option value="">Somente o contexto da tarefa</option>
                {(['projects', 'subjects', 'studyPaths'] as const).map(
                  (kind) => (
                    <optgroup
                      key={kind}
                      label={
                        kind === 'projects'
                          ? 'Projetos'
                          : kind === 'subjects'
                            ? 'Disciplinas'
                            : 'Trilhas'
                      }
                    >
                      {data[kind]
                        .filter((item) => item.status !== 'archived')
                        .map((item) => (
                          <option key={item.id} value={`${kind}:${item.id}`}>
                            {item.title}
                          </option>
                        ))}
                    </optgroup>
                  ),
                )}
              </select>
            </label>
          </details>
        </form>
      )}
      <FocusPreferences />
      <FocusHistory sessions={data.focusSessions} />
      {confirm && active && (
        <EntrySheet
          title="Encerrar sessão?"
          description={`Você realizou ${(elapsedFocusMs(active, now) / 60000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} min. ${ended ? 'O tempo planejado terminou. Confirme se concluiu a sessão.' : 'Encerrar agora registra uma sessão interrompida.'}`}
          onClose={() => setConfirm(false)}
        >
          <div className="direction-actions">
            <button
              className="button"
              autoFocus
              onClick={() => setConfirm(false)}
            >
              Continuar sessão
            </button>
            {ended && (
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void finish('complete')}
              >
                Concluir sessão
              </button>
            )}
            <button
              className="button"
              disabled={busy}
              onClick={() => void finish('interrupt')}
            >
              Encerrar como interrompida
            </button>
          </div>
          {error && (
            <p role="alert" className="data-error">
              {error}
            </p>
          )}
        </EntrySheet>
      )}
    </div>
  )
}
