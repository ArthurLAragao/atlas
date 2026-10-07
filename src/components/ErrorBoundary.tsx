import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <section className="module-intro" role="alert">
          <h1>Não foi possível abrir esta página.</h1>
          <p>
            Recarregue para tentar novamente. Suas preferências serão mantidas.
          </p>
          <button className="button" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </section>
      )
    return this.props.children
  }
}
