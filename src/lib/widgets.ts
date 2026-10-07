export const widgetNames = {
  priorities: 'Prioridades',
  review: 'Revisar pendências',
  appointment: 'Próximo compromisso',
  goal: 'Meta semanal',
  habits: 'Hábitos de hoje',
  exam: 'Próxima prova ou entrega',
  path: 'Próxima etapa da trilha',
  flashcards: 'Flashcards para hoje',
  focus: 'Foco',
} as const
export type WidgetId = keyof typeof widgetNames
export interface WidgetPreference {
  id: WidgetId
  visible: boolean
}
export const widgetIds = Object.keys(widgetNames) as WidgetId[]
export function defaultWidgets(): WidgetPreference[] {
  return widgetIds.map((id) => ({
    id,
    visible: ['priorities', 'review', 'appointment', 'goal', 'habits'].includes(
      id,
    ),
  }))
}
export function normalizeWidgets(raw: unknown): WidgetPreference[] {
  if (!Array.isArray(raw)) return defaultWidgets()
  const result: WidgetPreference[] = []
  for (const value of raw) {
    if (
      value &&
      typeof value === 'object' &&
      'id' in value &&
      widgetIds.includes(value.id as WidgetId) &&
      'visible' in value &&
      typeof value.visible === 'boolean' &&
      !result.some((item) => item.id === value.id)
    )
      result.push({ id: value.id as WidgetId, visible: value.visible })
  }
  return [
    ...result,
    ...defaultWidgets().filter(
      (item) => !result.some((saved) => saved.id === item.id),
    ),
  ]
}
export function visibleWidgets(items: readonly WidgetPreference[]): WidgetId[] {
  return normalizeWidgets(items)
    .filter((item) => item.visible)
    .map((item) => item.id)
}
export function moveWidget(
  items: readonly WidgetPreference[],
  id: WidgetId,
  target: number,
): WidgetPreference[] {
  const result = normalizeWidgets(items)
  const position = result.findIndex((item) => item.id === id)
  if (
    !Number.isInteger(target) ||
    target < 0 ||
    target >= result.length ||
    position === target
  )
    return result
  const [item] = result.splice(position, 1)
  if (item) result.splice(target, 0, item)
  return result
}
