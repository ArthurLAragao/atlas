import { Link } from 'react-router-dom'
import { LumenCaptureButton } from '../notes/LumenCaptureButton'

export function WorkspaceActions() {
  return <section className="workspace-hub" aria-label="Ambiente de trabalho e estudo">
    <h2>Seu ambiente</h2>
    <p>Escolha uma atividade e reúna o material antes de começar.</p>
    <div className="workspace-actions">
      <Link className="button" to="/estudos">Estudar e revisar</Link>
      <Link className="button" to="/foco">Abrir foco</Link>
      <LumenCaptureButton />
      <a className="button" href="https://www.notion.so/">Abrir Notion</a>
      <a className="button" href="spotify:">Abrir Spotify</a>
    </div>
  </section>
}
