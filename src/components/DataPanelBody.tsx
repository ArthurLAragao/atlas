import { useData } from '../app/data-store'
import { recordCount, removableExamples } from '../lib/data-integrity'
import { DataTransfer } from './DataTransfer'
import { DataFeedback } from './DataFeedback'

export function DataPanelBody() {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const removeExamples = useData((state) => state.removeExamples)
  const examples = recordCount(removableExamples(data))
  return (
    <>
      <p className="data-count">
        {recordCount(data)}{' '}
        {recordCount(data) === 1 ? 'registro salvo' : 'registros salvos'}{' '}
        localmente
      </p>
      <DataTransfer />
      <section className="data-section" aria-labelledby="examples-title">
        <h3 id="examples-title">Comece com seu próprio conteúdo</h3>
        <p>
          Remova apenas exemplos que não foram editados nem vinculados aos seus
          registros. Eles não voltarão ao reabrir o Atlas.
        </p>
        <div className="button-row">
          <button
            className="button"
            disabled={busy || examples === 0}
            onClick={() => void removeExamples()}
          >
            Remover exemplos ({examples})
          </button>
        </div>
      </section>
      <DataFeedback />
    </>
  )
}
