import { experienceSummary } from './experience'
import { z } from 'zod'
import { emptySnapshot, type Snapshot, type Collection } from '../data/models'
import { recordCount, validateSnapshot } from './data-records'
import { readNoteMarkdown } from './note-markdown'

export const maxImportBytes = 5 * 1024 * 1024
export const maxBackupBytes = 50 * 1024 * 1024
export const markdownMarker = '<!-- ATLAS_BACKUP_V1 -->'
const envelopeSchema = z
  .object({
    format: z.literal('atlas'),
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime({ offset: true }),
    data: z.unknown(),
  })
  .strict()
const collectionTitles = {
  tasks: 'Tarefas',
  habits: 'Hábitos',
  habitLogs: 'Registros de hábitos',
  notes: 'Notas',
  goals: 'Metas',
  projects: 'Projetos',
  subjects: 'Disciplinas',
  studyPaths: 'Trilhas de estudo',
  flashcards: 'Flashcards',
  focusSessions: 'Sessões de foco',
}

export function encodeBackup(data: Snapshot, now = new Date()): string {
  return JSON.stringify(
    {
      format: 'atlas',
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      data: validateSnapshot(data),
    },
    null,
    2,
  )
}

export function decodeBackup(text: string): Snapshot {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('JSON inválido. Selecione um backup Atlas completo.')
  }
  const result = envelopeSchema.safeParse(value)
  if (!result.success)
    throw new Error(
      'Formato ou versão de backup incompatível. Use um backup Atlas versão 1.',
    )
  return validateSnapshot(result.data.data)
}

function line(text: string) {
  return text.replace(/[\r\n]/g, ' ').replace(/[\\`*_{}[\]<>#|]/g, '\\$&')
}
export function encodeMarkdown(data: Snapshot, now = new Date()): string {
  const json = encodeBackup(data, now)
  const sections = [
    `XP: ${experienceSummary(data.experience).total} · ${data.experience.length} ações registradas`,
    '# Atlas — cópia dos seus dados',
    'Esta cópia inclui uma leitura em Markdown e um bloco de restauração completo ao final. A reimportação usa esse bloco. Para importar texto editado como nota, use um arquivo .md separado sem o bloco.',
    ...Object.entries(collectionTitles).flatMap(([key, label]) => {
      const name = key as Collection
      return [
        `## ${label}`,
        ...data[name].map((item) => {
          if ('habitId' in item)
            return `- ${item.date} · ${line(data.habits.find((habit) => habit.id === item.habitId)?.title ?? item.habitId)}: ${item.value}${item.rest ? ' (descanso)' : ''}`
          if ('question' in item)
            return `### ${line(item.question)}\n\n${item.answer}\n\nPróxima revisão: ${item.review.nextReview}`
          if ('plannedSeconds' in item)
            return `### ${line(item.title)}\n\n${item.startedAt} · ${item.mode} · ${item.status} · ${item.elapsedMs / 1000} segundos registrados`
          const details =
            'content' in item
              ? item.content
              : 'urls' in item
                ? item.description
                : 'dueDate' in item
                  ? `Estado: ${item.status} · Prazo: ${item.dueDate ?? 'sem prazo'}`
                  : 'target' in item
                    ? `Alvo: ${item.target} ${line(item.unit)} · ${item.timesPerWeek}x/semana`
                    : 'events' in item
                      ? `${item.notes}\n\n${item.events.map((event) => `- ${line(event.title)}: ${event.date} (${event.status})`).join('\n')}`
                      : 'steps' in item
                        ? `${item.description}\n\n${item.steps.map((step) => `- [${step.done ? 'x' : ' '}] ${line(step.title)}`).join('\n')}`
                        : item.keyResults
                            .map(
                              (result) =>
                                `- ${line(result.title)}: ${result.current}/${result.target}`,
                            )
                            .join('\n')
          return `### ${line(item.title)}\n\n${item.tags.map((tag) => `#${line(tag)}`).join(' ')}\n\n${details}`
        }),
      ]
    }),
    '## Bloco de restauração — não editar',
    markdownMarker,
    `\`\`\`json\n${json}\n\`\`\``,
  ]
  return sections.join('\n\n') + '\n'
}

export function parseImport(
  text: string,
  filename: string,
  now = new Date(),
  newId: string = crypto.randomUUID(),
): Snapshot {
  const limit = /\.json$/i.test(filename) ? maxBackupBytes : maxImportBytes
  if (new TextEncoder().encode(text).byteLength > limit)
    throw new Error(
      `O limite é ${limit / 1024 / 1024} MB por arquivo. Divida o conteúdo e tente novamente.`,
    )
  const clean = text.replace(/^\uFEFF/, '')
  if (/\.json$/i.test(filename)) return decodeBackup(clean)
  if (!/\.(md|markdown)$/i.test(filename))
    throw new Error('Selecione um arquivo .json, .md ou .markdown.')
  const metadata = readNoteMarkdown(clean)
  // Match a standalone marker; note content inside JSON may contain the same text.
  const markerIndex =
    [...clean.matchAll(/^<!-- ATLAS_BACKUP_V1 -->\r?$/gm)].at(-1)?.index ?? -1
  if (markerIndex >= 0 && !metadata) {
    const block = clean
      .slice(markerIndex + markdownMarker.length)
      .trim()
      .match(/^```json\s*\n([\s\S]*)\n```\s*$/)
    if (!block?.[1])
      throw new Error(
        'O bloco de restauração Markdown está incompleto. Use a cópia original.',
      )
    return decodeBackup(block[1])
  }
  if (!clean.trim())
    throw new Error('O arquivo está vazio. Escolha uma nota com conteúdo.')
  const heading = clean.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const title = (heading || filename.replace(/\.(md|markdown)$/i, '')).slice(
    0,
    240,
  )
  const data = emptySnapshot()
  data.notes.push({
    id: newId,
    title: metadata?.title ?? title,
    content: metadata?.content ?? clean,
    tags: metadata?.tags ?? [],
    ...(metadata ? { archivedAt: metadata.archivedAt } : {}),
    links: [],
    isExample: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  })
  return validateSnapshot(data)
}

export function importSummary(data: Snapshot): string {
  return `${recordCount(data)} registros: ${data.tasks.length} tarefas, ${data.habits.length} hábitos, ${data.habitLogs.length} registros de hábitos, ${data.notes.length} notas, ${data.goals.length} metas, ${data.projects.length} projetos, ${data.subjects.length} disciplinas, ${data.studyPaths.length} trilhas, ${data.flashcards.length} flashcards e ${data.focusSessions.length} sessões de foco.${data.routine ? ' Rotina semanal incluída. Se já houver uma rotina neste navegador, ela será preservada.' : ''}`
}
