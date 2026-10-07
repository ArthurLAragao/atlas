import type { Note } from '../data/models'

export const noteKey = (title: string) =>
  title.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR')

export function resolveNote(
  title: string,
  notes: readonly Note[],
): Note | undefined {
  const matches = notes.filter((note) => noteKey(note.title) === noteKey(title))
  return matches.length === 1 ? matches[0] : undefined
}
