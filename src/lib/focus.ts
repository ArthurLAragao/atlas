import type { FocusSession, Snapshot } from '../data/models'

export type FocusMode = FocusSession['mode']
export type FocusAction = 'pause' | 'resume' | 'complete' | 'interrupt'
export const focusModeLabels: Record<FocusMode, string> = {
  focus: 'Foco',
  shortBreak: 'Pausa curta',
  longBreak: 'Pausa longa',
}
export function elapsedFocusMs(session: FocusSession, now: number): number {
  if (!Number.isFinite(now)) throw new RangeError('Use um horário válido.')
  const delta =
    session.status === 'in-progress' &&
    session.timerState === 'running' &&
    session.segmentStartedAt
      ? Math.max(0, now - Date.parse(session.segmentStartedAt))
      : 0
  return Math.min(session.plannedSeconds * 1000, session.elapsedMs + delta)
}
export function remainingFocusSeconds(
  session: FocusSession,
  now: number,
): number {
  return Math.ceil(
    (session.plannedSeconds * 1000 - elapsedFocusMs(session, now)) / 1000,
  )
}
export function focusClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}
/** Read/recovery never mutates a session. Only explicit transitions can complete it. */
export function transitionFocus(
  session: FocusSession,
  action: FocusAction,
  now: number,
): FocusSession {
  const elapsedMs = elapsedFocusMs(session, now)
  if (session.status !== 'in-progress') {
    if (
      (session.status === 'completed' && action === 'complete') ||
      (session.status === 'interrupted' && action === 'interrupt')
    )
      return session
    throw new Error('Esta sessão já terminou. Inicie outra sessão.')
  }
  const timestamp = new Date(
    Math.max(now, Date.parse(session.startedAt)),
  ).toISOString()
  if (action === 'complete' && elapsedMs < session.plannedSeconds * 1000)
    throw new Error(
      'O tempo ainda não terminou. Encerre como interrompida ou continue.',
    )
  if (action === 'resume') {
    if (elapsedMs >= session.plannedSeconds * 1000)
      throw new Error(
        'O tempo terminou. Confirme a conclusão ou encerre como interrompida.',
      )
    if (session.timerState === 'running') return session
    return { ...session, timerState: 'running', segmentStartedAt: timestamp }
  }
  return {
    ...session,
    elapsedMs,
    timerState: 'paused',
    segmentStartedAt: null,
    status:
      action === 'pause'
        ? 'in-progress'
        : action === 'complete'
          ? 'completed'
          : 'interrupted',
    endedAt: action === 'pause' ? null : timestamp,
  }
}
/** Capture context IDs at the moment the user starts; never infer goal success. */
export function focusContext(
  data: Snapshot,
  taskId: string | null,
): FocusSession['links'] {
  if (!taskId) return []
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) throw new Error('A tarefa não existe mais. Escolha outra tarefa.')
  const links: FocusSession['links'] = task.links.filter((link) =>
    ['projects', 'subjects', 'studyPaths'].includes(link.type),
  )
  for (const kind of ['projects', 'subjects', 'studyPaths'] as const) {
    for (const item of data[kind]) {
      if (
        item.links.some(
          (link) => link.type === 'tasks' && link.id === taskId,
        ) ||
        ('events' in item &&
          item.events.some((event) => event.taskId === taskId)) ||
        ('steps' in item && item.steps.some((step) => step.taskId === taskId))
      )
        links.push({ type: kind, id: item.id })
    }
  }
  return [
    ...new Map(links.map((link) => [`${link.type}:${link.id}`, link])).values(),
  ]
}
