import { isValid } from 'date-fns'
import {
  habitSchema,
  noteSchema,
  taskSchema,
  type Habit,
  type Note,
  type Task,
} from '../data/models'
import { parseTaskInput, type ParsedTaskInput } from './task-parser'

export type ParsedCapture =
  | { kind: 'task'; parsed: ParsedTaskInput }
  | { kind: 'note' | 'habit'; title: string; tags: string[] }

export type CapturedEntity =
  | { collection: 'tasks'; item: Task }
  | { collection: 'notes'; item: Note }
  | { collection: 'habits'; item: Habit }

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
}

/**
 * Only standalone, valid tags are metadata here. Dates, times and priorities
 * are ordinary prose in notes and habits; malformed/excess tags stay visible.
 */
function titleAndTags(input: string): { title: string; tags: string[] } {
  const kept: string[] = []
  const tags = new Set<string>()
  for (const raw of input.trim().split(/\s+/u).filter(Boolean)) {
    const word = raw.replace(/[.,;!?]+$/u, '') || raw
    const tag = word.startsWith('#') ? word.slice(1).normalize('NFC') : ''
    const key = tag.toLocaleLowerCase('pt-BR')
    if (
      tag.length <= 60 &&
      /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,59}$/u.test(tag) &&
      (tags.size < 50 || tags.has(key))
    ) {
      tags.add(key)
    } else {
      kept.push(raw)
    }
  }
  return { title: kept.join(' '), tags: [...tags] }
}

export function parseCapture(input: string, now: Date): ParsedCapture {
  if (!isValid(now)) throw new RangeError('Use uma data de referência válida.')
  const match = /^\s*([\p{L}\p{M}]+)\s*:\s*/u.exec(input)
  const prefix = match ? normalized(match[1]!) : ''
  const kind =
    prefix === 'nota'
      ? 'note'
      : prefix === 'habito'
        ? 'habit'
        : prefix === 'tarefa'
          ? 'task'
          : undefined
  const body = kind && match ? input.slice(match[0].length) : input
  if (kind === 'note' || kind === 'habit') {
    return { kind, ...titleAndTags(body) }
  }
  return { kind: 'task', parsed: parseTaskInput(body, now) }
}

/** IDs and time come from the caller; this factory never writes or reads storage. */
export function createCapturedEntity(
  parsed: ReturnType<typeof parseCapture>,
  now: Date,
  id: string,
): CapturedEntity {
  if (!isValid(now)) throw new RangeError('Use uma data de referência válida.')
  const timestamp = now.toISOString()
  const base = {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    isExample: false,
    links: [],
  }
  if (parsed.kind === 'task') {
    // Warnings belong to the preview, never to persisted task records.
    const item = taskSchema.parse({
      ...base,
      title: parsed.parsed.title,
      dueDate: parsed.parsed.dueDate,
      dueTime: parsed.parsed.dueTime,
      priority: parsed.parsed.priority,
      tags: [...parsed.parsed.tags],
      status: 'todo',
      context: null,
      subtasks: [],
      repeat: null,
      focusMinutes: 0,
    })
    return { collection: 'tasks', item }
  }
  if (parsed.kind === 'note') {
    if (/\[\[|\]\]|[\r\n]/u.test(parsed.title))
      throw new Error(
        'Use um título sem [[, ]] ou quebras de linha para conectar suas notas.',
      )
    return {
      collection: 'notes',
      item: noteSchema.parse({
        ...base,
        title: parsed.title,
        tags: [...parsed.tags],
        content: '',
      }),
    }
  }
  return {
    collection: 'habits',
    item: habitSchema.parse({
      ...base,
      title: parsed.title,
      tags: [...parsed.tags],
      kind: 'binary',
      target: 1,
      unit: 'vez',
      timesPerWeek: 7,
    }),
  }
}
