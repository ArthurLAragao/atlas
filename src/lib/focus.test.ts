import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusSessionSchema, type FocusSession } from '../data/models'
import { buildSeed } from '../data/seed'
import {
  elapsedFocusMs,
  focusClock,
  focusContext,
  remainingFocusSeconds,
  transitionFocus,
} from './focus'

const start = Date.parse('2026-10-03T12:00:00Z')
export function session(): FocusSession {
  return {
    id: 'focus',
    title: 'Revisar árvores',
    tags: [],
    links: [],
    isExample: false,
    createdAt: new Date(start).toISOString(),
    updatedAt: new Date(start).toISOString(),
    startedAt: new Date(start).toISOString(),
    segmentStartedAt: new Date(start).toISOString(),
    endedAt: null,
    mode: 'focus',
    status: 'in-progress',
    timerState: 'running',
    plannedSeconds: 1500,
    elapsedMs: 0,
    taskId: null,
  }
}
afterEach(() => vi.useRealTimers())
describe('timer baseado em timestamps', () => {
  it('calcula tempo mesmo sem ticks em segundo plano', () => {
    vi.useFakeTimers()
    vi.setSystemTime(start)
    const running = session()
    vi.advanceTimersByTime(321_456)
    expect(elapsedFocusMs(running, Date.now())).toBe(321456)
    expect(remainingFocusSeconds(running, Date.now())).toBe(1179)
  })
  it('refresh desserializa o mesmo relógio sem acelerar, duplicar ou concluir', () => {
    const original = session()
    const restored = focusSessionSchema.parse(
      JSON.parse(JSON.stringify(original)),
    )
    expect(remainingFocusSeconds(restored, start + 400_000)).toBe(1100)
    expect(remainingFocusSeconds(restored, start + 99_999_999)).toBe(0)
    expect(restored.status).toBe('in-progress')
    expect(restored.endedAt).toBeNull()
    expect(original).toEqual(restored)
  })
  it('pausa registra frações reais e retoma excluindo o período pausado', () => {
    const paused = transitionFocus(session(), 'pause', start + 10550)
    expect(paused).toMatchObject({
      elapsedMs: 10550,
      timerState: 'paused',
      segmentStartedAt: null,
      status: 'in-progress',
    })
    expect(elapsedFocusMs(paused, start + 300000)).toBe(10550)
    const restored = focusSessionSchema.parse(
      JSON.parse(JSON.stringify(paused)),
    )
    const resumed = transitionFocus(restored, 'resume', start + 300000)
    expect(elapsedFocusMs(resumed, start + 315000)).toBe(25550)
  })
  it('concluir exige tempo esgotado e ação explícita; encerramento precoce é interrompido', () => {
    expect(() => transitionFocus(session(), 'complete', start + 1000)).toThrow(
      /ainda/,
    )
    const interrupted = transitionFocus(session(), 'interrupt', start + 15050)
    expect(interrupted).toMatchObject({
      status: 'interrupted',
      elapsedMs: 15050,
      timerState: 'paused',
      endedAt: new Date(start + 15050).toISOString(),
    })
    const completed = transitionFocus(session(), 'complete', start + 9000000)
    expect(completed).toMatchObject({ status: 'completed', elapsedMs: 1500000 })
    expect(focusSessionSchema.safeParse(completed).success).toBe(true)
  })
  it('limita o tempo planejado após abandono sem marcar sucesso', () => {
    const abandoned = transitionFocus(
      session(),
      'interrupt',
      start + 3 * 86400000,
    )
    expect(abandoned.elapsedMs).toBe(1500000)
    expect(abandoned.status).toBe('interrupted')
  })
  it('retrocesso do relógio não produz tempo negativo', () => {
    expect(elapsedFocusMs(session(), start - 9999)).toBe(0)
    const paused = transitionFocus(session(), 'pause', start - 9999)
    expect(paused.elapsedMs).toBe(0)
  })
  it('transições repetidas não reiniciam segmentos ou repetem conclusão', () => {
    const running = session()
    expect(transitionFocus(running, 'resume', start + 30000)).toBe(running)
    const complete = transitionFocus(running, 'complete', start + 1500000)
    expect(transitionFocus(complete, 'complete', start + 2000000)).toBe(
      complete,
    )
    expect(() => transitionFocus(complete, 'resume', start + 2000000)).toThrow()
    expect(() => transitionFocus(running, 'resume', start + 2000000)).toThrow()
  })
  it.each([
    [0, '00:00'],
    [61, '01:01'],
    [1500, '25:00'],
    [10800, '180:00'],
  ])('formata %i como %s', (seconds, value) => {
    expect(focusClock(Number(seconds))).toBe(value)
  })
  it('recusa estados inconsistentes em backup', () => {
    expect(
      focusSessionSchema.safeParse({ ...session(), status: 'completed' })
        .success,
    ).toBe(false)
    expect(
      focusSessionSchema.safeParse({ ...session(), timerState: 'paused' })
        .success,
    ).toBe(false)
    expect(
      focusSessionSchema.safeParse({ ...session(), elapsedMs: 1500001 })
        .success,
    ).toBe(false)
    expect(() => elapsedFocusMs(session(), NaN)).toThrow()
  })
  it('propaga IDs diretos, recíprocos e de eventos/etapas sem afetar metas', () => {
    const data = buildSeed(new Date(start))
    const task = data.tasks[0]!
    task.links.push({ type: 'subjects', id: data.subjects[0]!.id })
    data.subjects[0]!.events = [
      {
        id: 'exam',
        title: 'Prova',
        date: '2026-10-04',
        kind: 'exam',
        status: 'pending',
        description: '',
        taskId: task.id,
      },
    ]
    data.studyPaths[0]!.steps[0]!.taskId = task.id
    const copy = structuredClone(data)
    const links = focusContext(data, task.id)
    expect(links).toEqual(
      expect.arrayContaining([
        { type: 'projects', id: 'example-project' },
        { type: 'subjects', id: data.subjects[0]!.id },
        { type: 'studyPaths', id: data.studyPaths[0]!.id },
      ]),
    )
    expect(links.filter((link) => link.type === 'subjects')).toHaveLength(1)
    expect(links.some((link) => link.type === 'goals')).toBe(false)
    expect(data).toEqual(copy)
    expect(focusContext(data, null)).toEqual([])
    expect(() => focusContext(data, 'missing')).toThrow()
  })
})
