export type WorkspaceCommand =
  | 'study'
  | 'focus'
  | 'notion'
  | 'spotify'
  | 'lumen'
  | 'obsidian'
  | 'orca'
  | 'tasks'
  | 'notes'
  | 'capture'
  | null

export function workspaceCommand(text: string): WorkspaceCommand {
  const normalized = text
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.!?]/g, '')
    .trim()
  if (['abrir estudos', 'estudar'].includes(normalized)) return 'study'
  if (['abrir foco', 'iniciar foco'].includes(normalized)) return 'focus'
  if (normalized === 'abrir notion') return 'notion'
  if (normalized === 'abrir spotify') return 'spotify'
  if (normalized === 'abrir lumen') return 'lumen'
  if (['abrir obsidian', 'abrir contexto'].includes(normalized))
    return 'obsidian'
  if (['abrir orca', 'abrir agentes'].includes(normalized)) return 'orca'
  if (normalized === 'abrir tarefas') return 'tasks'
  if (['abrir notas', 'anotar no dia'].includes(normalized)) return 'notes'
  if (['capturar video', 'resumir video'].includes(normalized)) return 'capture'
  return null
}
