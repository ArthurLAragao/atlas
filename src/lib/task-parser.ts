import { addDays, isValid } from 'date-fns'
import type { Task } from '../data/models'
import { dateKey } from './habits'

export interface ParsedTaskInput {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Task['priority']
  tags: string[]
  warnings: string[]
}

const weekdays = new Map<string, number>([
  ['domingo', 0],
  ['segunda', 1],
  ['terca', 2],
  ['quarta', 3],
  ['quinta', 4],
  ['sexta', 5],
  ['sabado', 6],
])
const priorities = new Map<string, Task['priority']>([
  ['baixa', 'low'],
  ['media', 'medium'],
  ['alta', 'high'],
])

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
}

function calendarKey(year: number, month: number, day: number): string | null {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31)
    return null
  // setFullYear also handles years 1–99, unlike the multi-argument constructor.
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null
  return dateKey(date)
}

/**
 * Deliberately small Portuguese parser. Metadata must occupy separate words.
 * The first date/time/priority wins; unsupported or conflicting metadata stays
 * in the title with an actionable warning. dd/mm uses the current local year.
 */
export function parseTaskInput(input: string, now: Date): ParsedTaskInput {
  if (!isValid(now)) throw new RangeError('Use uma data de referência válida.')
  const result: ParsedTaskInput = {
    title: '',
    dueDate: null,
    dueTime: null,
    priority: 'medium',
    tags: [],
    warnings: [],
  }
  const words = input.trim().split(/\s+/u).filter(Boolean)
  const kept: string[] = []
  let prioritySet = false
  const tagKeys = new Set<string>()

  function setDate(value: string, count: number, index: number): boolean {
    if (result.dueDate !== null && result.dueDate !== value) {
      result.warnings.push(
        `Mais de um prazo: “${words.slice(index, index + count).join(' ')}” ficou no título. Edite a data no formulário.`,
      )
      return false
    }
    result.dueDate = value
    return true
  }

  for (let index = 0; index < words.length; index += 1) {
    const raw = words[index]!
    // Sentence punctuation is accepted after metadata, but preserved in prose.
    const word = raw.replace(/[.,;!?]+$/u, '') || raw
    const key = normalized(word)
    const next = normalized(words[index + 1]?.replace(/[.,;!?]+$/u, '') ?? '')
    const third = normalized(words[index + 2]?.replace(/[.,;!?]+$/u, '') ?? '')

    if (word.startsWith('#')) {
      const tag = word.slice(1).normalize('NFC')
      const tagKey = tag.toLocaleLowerCase('pt-BR')
      if (tag.length > 60 || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,59}$/u.test(tag)) {
        result.warnings.push(
          `Tag “${raw}” inválida. Use até 60 letras, números, hífens ou sublinhados.`,
        )
      } else if (result.tags.length >= 50 && !tagKeys.has(tagKey)) {
        result.warnings.push('Use até 50 tags. A tag extra ficou no título.')
      } else {
        if (!tagKeys.has(tagKey)) {
          result.tags.push(tagKey)
          tagKeys.add(tagKey)
        }
        continue
      }
      kept.push(raw)
      continue
    }

    if (word.startsWith('!')) {
      const priority = priorities.get(key.slice(1))
      if (!priority) {
        result.warnings.push(
          `Prioridade “${raw}” não reconhecida. Use !alta, !média ou !baixa.`,
        )
      } else if (prioritySet && result.priority !== priority) {
        result.warnings.push(
          `Mais de uma prioridade: “${raw}” ficou no título. Edite a prioridade no formulário.`,
        )
      } else {
        result.priority = priority
        prioritySet = true
        continue
      }
      kept.push(raw)
      continue
    }

    let relativeDays: number | null = null
    let dateWords = 1
    if (key === 'hoje') relativeDays = 0
    if (key === 'amanha') relativeDays = 1
    if (key === 'depois' && next === 'de' && third === 'amanha') {
      relativeDays = 2
      dateWords = 3
    }
    if (relativeDays !== null) {
      if (setDate(dateKey(addDays(now, relativeDays)), dateWords, index)) {
        index += dateWords - 1
        continue
      }
      kept.push(...words.slice(index, index + dateWords))
      index += dateWords - 1
      continue
    }

    const weekdayPrefix = ['proxima', 'proximo', 'na', 'no'].includes(key)
    const weekdayWord = (weekdayPrefix ? next : key).replace(/-feira$/u, '')
    const weekday = weekdays.get(weekdayWord)
    if (weekday !== undefined) {
      let distance = (weekday - now.getDay() + 7) % 7
      if (distance === 0 && ['proxima', 'proximo'].includes(key)) distance = 7
      dateWords = weekdayPrefix ? 2 : 1
      if (setDate(dateKey(addDays(now, distance)), dateWords, index)) {
        index += dateWords - 1
        continue
      }
      kept.push(...words.slice(index, index + dateWords))
      index += dateWords - 1
      continue
    }

    if (/^\d{4}-/u.test(word) || /^\d{1,2}\//u.test(word)) {
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(word)
      const local = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/u.exec(word)
      const date = iso
        ? calendarKey(Number(iso[1]), Number(iso[2]), Number(iso[3]))
        : local
          ? calendarKey(
              local[3] ? Number(local[3]) : now.getFullYear(),
              Number(local[2]),
              Number(local[1]),
            )
          : null
      if (date && setDate(date, 1, index)) continue
      if (!date)
        result.warnings.push(
          `Data “${raw}” inválida. Use DD/MM, DD/MM/AAAA ou AAAA-MM-DD.`,
        )
      kept.push(raw)
      continue
    }

    const timePrefix = key === 'as' && /^\d+(?:h|:\d)/iu.test(next)
    const timeWord = timePrefix
      ? words[index + 1]!.replace(/[.,;!?]+$/u, '')
      : word
    if (/^\d+(?:h|:\d)/iu.test(timeWord)) {
      const time = /^(\d{1,2})(?:h(\d{2})?|:(\d{2}))$/iu.exec(timeWord)
      const hour = time ? Number(time[1]) : -1
      const minute = time ? Number(time[2] ?? time[3] ?? 0) : -1
      const count = timePrefix ? 2 : 1
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
        if (result.dueTime !== null && result.dueTime !== formatted) {
          result.warnings.push(
            `Mais de um horário: “${words.slice(index, index + count).join(' ')}” ficou no título. Edite o horário no formulário.`,
          )
        } else {
          result.dueTime = formatted
          index += count - 1
          continue
        }
      } else {
        result.warnings.push(
          `Horário “${timeWord}” inválido. Use 19h, 19h30 ou 19:30.`,
        )
      }
      kept.push(...words.slice(index, index + count))
      index += count - 1
      continue
    }

    kept.push(raw)
  }

  result.title = kept.join(' ')
  if (result.dueTime && !result.dueDate) result.dueDate = dateKey(now)
  return result
}
