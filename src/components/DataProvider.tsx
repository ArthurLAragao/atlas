import { useEffect, useState, type ReactNode } from 'react'
import { connectData, useData } from '../app/data-store'

export function DataProvider({ children }: { children: ReactNode }) {
  const [attempt, retry] = useState(0)
  const status = useData((state) => state.status)
  const error = useData((state) => state.error)
  useEffect(() => connectData(), [attempt])
  if (status === 'loading')
    return (
      <main className="startup">
        <p role="status">Abrindo seus dados locais…</p>
      </main>
    )
  if (status === 'error')
    return (
      <main className="startup">
        <h1>Seus dados não puderam ser abertos.</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => retry((value) => value + 1)}>
          Tentar novamente
        </button>
      </main>
    )
  return children
}
