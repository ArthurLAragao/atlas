import { useState } from 'react'
import { Download } from 'lucide-react'
import { checkForUpdate, usePwa } from '../../app/pwa-store'
export function InstallApp() {
  const {
    installPrompt,
    installed,
    ready,
    registration,
    updateReady,
    offline,
  } = usePwa()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section aria-labelledby="preferences-install">
      <h2 id="preferences-install">Atlas no seu dispositivo</h2>
      <p>
        {installed
          ? 'Atlas aberto como aplicativo instalado.'
          : 'Instale para abrir o Atlas em uma janela própria. Seus dados continuam locais neste navegador.'}
      </p>
      <p role="status">
        {ready
          ? 'App preparado para recarga offline neste navegador.'
          : import.meta.env.DEV
            ? 'Use um build de produção para instalar e preparar a recarga offline.'
            : 'Preparando os arquivos do app para uso offline…'}
      </p>
      {installPrompt ? (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await installPrompt.prompt()
              const choice = await installPrompt.userChoice
              setMessage(
                choice.outcome === 'accepted'
                  ? 'Instalação solicitada ao navegador.'
                  : 'Você pode instalar depois pelo menu do navegador.',
              )
              usePwa.setState({ installPrompt: null })
            } catch {
              setMessage(
                'Use a opção Instalar aplicativo no menu do navegador.',
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          <Download aria-hidden="true" />
          Instalar Atlas
        </button>
      ) : (
        !installed && (
          <p className="caption">
            No menu do Chrome ou Edge, escolha Instalar Atlas. No iPhone/iPad,
            abra em Safari e use Compartilhar → Adicionar à Tela de Início. A
            opção depende do navegador.
          </p>
        )
      )}
      {registration && (
        <button
          className="button"
          disabled={offline}
          onClick={async () => {
            // Explicit checking reopens an update that was deferred earlier.
            if (usePwa.getState().updateReady)
              usePwa.setState({ dismissed: false })
            await checkForUpdate()
            setMessage(
              usePwa.getState().error ||
                (usePwa.getState().updateReady
                  ? 'Atualização pronta. Use Atualizar no aviso.'
                  : 'Verificação solicitada ao navegador. Uma nova versão será avisada quando estiver pronta.'),
            )
          }}
        >
          Verificar atualização
        </button>
      )}
      {updateReady && <p className="caption">Há uma atualização pronta.</p>}
      <p role="status">{message}</p>
    </section>
  )
}
