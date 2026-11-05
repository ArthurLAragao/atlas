import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workspaceCommand } from '../../lib/workspace-command'

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>
      }) => void)
    | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}
type RecognitionConstructor = new () => Recognition
function recognitionConstructor(): RecognitionConstructor | undefined {
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function WorkspaceVoice() {
  const navigate = useNavigate()
  const active = useRef<Recognition | null>(null)
  const [listening, setListening] = useState(false)
  const [commandText, setCommandText] = useState('')
  const [message, setMessage] = useState(
    'Diga “abrir foco”, “abrir agentes”, “abrir contexto”, “resumir vídeo” ou “anotar” seguido do seu registro.',
  )
  const [action, setAction] = useState<'notion' | 'spotify' | null>(null)
  async function openDesktop(action: string) {
    try {
      const response = await fetch('http://127.0.0.1:43128/api/health', {
        signal: AbortSignal.timeout(3000),
      })
      const value: unknown = await response.json()
      if (
        !response.ok ||
        !value ||
        typeof value !== 'object' ||
        !('token' in value) ||
        typeof value.token !== 'string'
      )
        throw new Error()
      const opened = await fetch('http://127.0.0.1:43128/api/apps/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lumen-Token': value.token,
        },
        body: JSON.stringify({
          command: /^(abrir|abra|iniciar|inicie|conectar)\s/i.test(action)
            ? action
            : 'abrir ' + action,
        }),
        signal: AbortSignal.timeout(10000),
      })
      const result: unknown = await opened.json()
      if (!opened.ok) {
        setMessage(
          result && typeof result === 'object' && 'error' in result
            ? String(result.error)
            : 'Não foi possível abrir o aplicativo.',
        )
        return
      }
      setMessage(
        result && typeof result === 'object' && 'opened' in result
          ? 'Abrindo ' + String(result.opened)
          : 'Pedido enviado ao aplicativo local.',
      )
    } catch {
      setMessage('Abra o Lumen para controlar os aplicativos por voz.')
      if (action === 'notion' || action === 'spotify') setAction(action)
    }
  }
  useEffect(
    () => () => {
      if (active.current) {
        active.current.onend = null
        active.current.onerror = null
        active.current.onresult = null
        active.current.abort()
      }
    },
    [],
  )
  function listen() {
    const Constructor = recognitionConstructor()
    if (!Constructor) {
      setMessage(
        'Reconhecimento de voz indisponível neste navegador. Use os botões ou dite nos campos com Win+H.',
      )
      return
    }
    setAction(null)
    const recognition = new Constructor()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ''
      const journal = text.match(/^(?:anotar|registrar)(?: no dia)?[\s:]+(.+)/i)
      if (journal && journal[1] !== 'no dia') {
        window.dispatchEvent(
          new CustomEvent('atlas:journal-draft', { detail: journal[1] }),
        )
        setMessage(
          'Rascunho preenchido. Diga “salvar registro” ou use o botão para gravar.',
        )
        return
      }
      if (
        ['salvar registro', 'salvar anotação', 'salvar anotacao'].includes(
          text.toLocaleLowerCase('pt-BR').replace(/[.!?]/g, '').trim(),
        )
      ) {
        document.getElementById('save-day-journal')?.click()
        setMessage(
          'Solicitação de salvar enviada. Confira a confirmação nas anotações do dia.',
        )
        return
      }
      const command = workspaceCommand(text)
      setMessage(
        command
          ? `Comando reconhecido: ${text}`
          : `Não reconheci uma ação para: ${text}`,
      )
      if (command === 'study') navigate('/estudos')
      if (command === 'focus') navigate('/foco')
      if (command === 'tasks') navigate('/tarefas')
      if (command === 'notes') navigate('/notas')
      if (command === 'capture')
        window.dispatchEvent(new Event('atlas:open-capture'))
      if (
        command === 'notion' ||
        command === 'spotify' ||
        command === 'obsidian' ||
        command === 'orca' ||
        command === 'lumen'
      )
        void openDesktop(command)
      if (!command && /^(abrir|abra|iniciar|inicie)\s/i.test(text))
        void openDesktop(text)
    }
    recognition.onerror = () => {
      setListening(false)
      setMessage(
        'Não foi possível ouvir. Confira o microfone e a permissão do navegador.',
      )
    }
    recognition.onend = () => setListening(false)
    active.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
      setMessage('Não foi possível iniciar o microfone.')
    }
  }
  return (
    <div>
      <button className="button" disabled={listening} onClick={listen}>
        {listening ? 'Ouvindo…' : 'Comando de voz'}
      </button>
      <p className="form-help" role="status">
        {message}
      </p>
      <form
        className="workspace-actions"
        onSubmit={(event) => {
          event.preventDefault()
          void openDesktop(commandText)
        }}
      >
        <label>
          Aplicativo
          <input
            aria-label="Aplicativo para abrir"
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            placeholder="Ex.: abrir Cursor"
          />
        </label>
        <button type="submit" className="button" disabled={!commandText.trim()}>
          Abrir aplicativo
        </button>
      </form>
      {action && (
        <a
          className="button"
          href={action === 'notion' ? 'https://www.notion.so/' : 'spotify:'}
          target={action === 'notion' ? '_blank' : undefined}
          rel="noreferrer"
        >
          Confirmar abertura de {action === 'notion' ? 'Notion' : 'Spotify'}
        </a>
      )}
      <p className="form-help">
        O navegador pode usar um serviço online para reconhecer a fala. Ativado
        somente ao clicar.
      </p>
    </div>
  )
}
