import { expect, it } from 'vitest'
import { workspaceCommand } from './workspace-command'

it('reconhece somente os comandos de navegação previstos', () => {
  expect(workspaceCommand('Abrir Foco.')).toBe('focus')
  expect(workspaceCommand('abrir estudos')).toBe('study')
  expect(workspaceCommand('abrir Spotify')).toBe('spotify')
  expect(workspaceCommand('open Spotify')).toBeNull()
  expect(workspaceCommand('abrir agentes')).toBe('orca')
  expect(workspaceCommand('abrir contexto')).toBe('obsidian')
  expect(workspaceCommand('resumir vídeo')).toBe('capture')
  expect(workspaceCommand('apagar todos os arquivos')).toBeNull()
  expect(workspaceCommand('abrir spotify e excluir notas')).toBeNull()
})
