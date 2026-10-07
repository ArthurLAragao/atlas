import type { Snapshot } from '../data/models'

export type SearchType = 'tasks' | 'habits' | 'notes' | 'goals' | 'projects'
export interface SearchEntry {
  id: string
  type: SearchType
  title: string
  preview: string
  tags: string[]
  archived: boolean
  text: string
  titleKey: string
}
export const searchKey = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
    .trim()
export const searchLabels: Record<SearchType, string> = {
  tasks: 'Tarefa',
  habits: 'Hábito',
  notes: 'Nota',
  goals: 'Meta',
  projects: 'Projeto',
}

export function createSearchIndex(data: Snapshot): SearchEntry[] {
  return (['tasks', 'habits', 'notes', 'goals', 'projects'] as const).flatMap(
    (type) =>
      data[type].map((item) => {
        const body =
          'content' in item
            ? item.content
            : 'urls' in item
              ? `${item.description} ${item.urls.map((url) => url.title).join(' ')}`
              : 'subtasks' in item
                ? item.subtasks.map((subtask) => subtask.title).join(' ')
                : 'keyResults' in item
                  ? `${item.description ?? ''} ${item.keyResults.map((key) => key.title).join(' ')}`
                  : item.unit
        return {
          id: item.id,
          type,
          title: item.title,
          preview: body.replace(/\s+/gu, ' ').slice(0, 160),
          tags: item.tags,
          archived:
            ('archivedAt' in item && Boolean(item.archivedAt)) ||
            ('status' in item && item.status === 'archived'),
          text: searchKey(`${item.title} ${body} ${item.tags.join(' ')}`),
          titleKey: searchKey(item.title),
        }
      }),
  )
}

export function searchEntries(
  index: readonly SearchEntry[],
  query: string,
  limit = 50,
): SearchEntry[] {
  const needle = searchKey(query)
  if (!needle) return []
  const terms = needle.split(' ')
  return index
    .filter((item) =>
      terms.every((term) =>
        term.startsWith('#')
          ? item.tags.some((tag) => searchKey(tag) === term.slice(1))
          : item.text.includes(term),
      ),
    )
    .sort(
      (a, b) =>
        Number(b.titleKey === needle) - Number(a.titleKey === needle) ||
        Number(a.archived) - Number(b.archived) ||
        a.title.localeCompare(b.title, 'pt-BR') ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit)
}

export function searchHref(entry: SearchEntry): string {
  if (entry.type === 'notes')
    return `/notas?note=${encodeURIComponent(entry.id)}`
  if (entry.type === 'habits')
    return `/habitos?habit=${encodeURIComponent(entry.id)}`
  if (entry.type === 'tasks')
    return `/tarefas?search=${encodeURIComponent(entry.title)}`
  return `/metas#record-${encodeURIComponent(entry.id)}`
}
