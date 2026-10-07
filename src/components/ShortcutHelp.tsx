import { useEffect } from 'react'
import { restoreCommandFocus, useCommands } from '../app/command-store'
import { EntrySheet } from './EntrySheet'
import '../styles/commands.css'

const shortcuts = [
  [
    'Space no Foco',
    'Iniciar, pausar ou retomar, quando não estiver digitando.',
  ],
  ['Escape no Foco', 'Abrir a confirmação para encerrar a sessão.'],
  [
    '0–5 após revelar um flashcard',
    'Avaliar a recordação e avançar para o próximo cartão.',
  ],
  ['Ctrl/Cmd + K', 'Abrir ou fechar a captura rápida, em qualquer tela.'],
  ['?', 'Abrir esta ajuda, quando não estiver digitando.'],
  [
    'Ctrl/Cmd + S em uma nota',
    'Salvar o texto e atualizar os vínculos e a busca.',
  ],
  [
    '[[ em uma nota',
    'Sugerir links: setas escolhem, Enter insere e Escape fecha.',
  ],
  ['Setas e Enter', 'Escolher e executar uma ação na caixa de comando.'],
  ['Escape', 'Fechar a caixa de comando, uma sheet ou um popover.'],
  ['Tab / Shift + Tab', 'Percorrer os controles para frente ou para trás.'],
  [
    'Setas no calendário',
    'Percorrer os dias; Home/End vai ao início/fim da semana.',
  ],
  ['Page Up / Page Down', 'Mudar o mês do calendário.'],
  [
    'Setas no heatmap',
    'Esquerda/direita percorre semanas; cima/baixo percorre dias.',
  ],
  [
    'Home / End em listas longas',
    'No nome do item, ir ao primeiro ou último item.',
  ],
] as const

export function ShortcutHelp() {
  const open = useCommands((state) => state.help)
  return open ? <OpenHelp /> : null
}

function OpenHelp() {
  useEffect(
    () => () => {
      requestAnimationFrame(() => {
        const command = useCommands.getState()
        if (!command.palette && !command.help) restoreCommandFocus()
      })
    },
    [],
  )
  return (
    <EntrySheet
      title="Atalhos de teclado"
      description="Um jeito rápido de usar o Atlas. As mesmas ações também têm controles na tela."
      onClose={() => useCommands.getState().closeHelp()}
    >
      <div className="shortcuts-help" data-shortcut-help>
        <dl className="shortcut-list">
          {shortcuts.map(([keys, description]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <p>
          Atalhos não interrompem formulários abertos. A captura aceita tarefas,
          notas e hábitos simples. Para ajustar um hábito quantitativo, abra
          Hábitos.
        </p>
        <button
          className="button"
          onClick={() => useCommands.getState().closeHelp()}
        >
          Fechar ajuda
        </button>
      </div>
    </EntrySheet>
  )
}
