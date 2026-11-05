export type CaptureItem = {
  id: string
  title: string
  state: string
  message: string
  exercise: string
  notionUrl: string | null
}

function notionUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      (!parsed.port || parsed.port === '443') &&
      ['app.notion.com', 'www.notion.so', 'notion.so'].includes(parsed.hostname)
      ? parsed.href : null
  } catch { return null }
}

export function decodeCapture(value: unknown): CaptureItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !/^[a-f0-9]{32}$/i.test(item.id) ||
    typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200 ||
    typeof item.state !== 'string' || !['queued', 'running', 'ready', 'failed'].includes(item.state) ||
    typeof item.message !== 'string' || item.message.length > 2000) return null
  return {
    id: item.id, title: item.title, state: item.state, message: item.message,
    exercise: typeof item.exercise === 'string' && item.exercise.length <= 100_000 ? item.exercise : '',
    notionUrl: item.publication === 'published' ? notionUrl(item.notion_url) : null,
  }
}

export function captureReference(item: CaptureItem) {
  return {
    id: 'lumen-capture-' + item.id,
    title: item.title,
    content: `# Prática sugerida\n\n${item.exercise}\n\n## Referência\n\n${item.notionUrl ?? 'Publicação no Notion ainda não confirmada.'}\n\nSugestão gerada por IA; revise antes de praticar. Não representa estudo concluído.\n`,
    tags: ['lumen', 'pratica'],
  }
}
