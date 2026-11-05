import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { activeLumenTestSession } from '../../lib/lumen-test-environment'
import { noteDraftStorageKey, useDrafts } from './draft-store'
import { createLumenSession } from './lumen-service'
import type { LumenTransferSession } from './lumen-session'
import type { Note } from '../../data/models'
import {
  historyNotice,
  lumenMessage,
  operationLabel,
} from './lumen-presentation'
import '../../styles/lumen-transfer.css'

export default function LumenTransferDialog({
  mode,
  onClose,
  session: supplied,
}: {
  mode: 'import' | 'history'
  onClose: () => void
  session?: LumenTransferSession
}) {
  const [session] = useState(() => supplied ?? createLumenSession())
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLParagraphElement>(null)
  const confirming =
    state.phase === 'confirm' || state.phase === 'restore-confirm'
  useEffect(() => {
    if (mode === 'history') void session.loadHistory()
    const drafts = useDrafts.subscribe(() => session.invalidate())
    const data = useData.subscribe((next, before) => {
      if (next.data.notes !== before.data.notes) session.invalidate()
    })
    const external = (event: StorageEvent) => {
      if (event.key === null || event.key === noteDraftStorageKey)
        session.invalidate()
    }
    const focus = () => session.invalidate()
    window.addEventListener('storage', external)
    window.addEventListener('focus', focus)
    return () => {
      drafts()
      data()
      window.removeEventListener('storage', external)
      window.removeEventListener('focus', focus)
      session.cancel()
    }
  }, [mode, session])
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    if (state.phase === 'result') resultRef.current?.focus()
  }, [confirming, state.phase])
  const close = () => {
    if (session.cancel()) onClose()
  }
  const plan = state.plan
  const restore = state.restore
  const proposed = plan?.proposed
  const changed =
    plan?.operation === 'create'
      ? 'Título, tags e Markdown completo; identidade e datas locais da nova nota.'
      : plan?.operation === 'identical'
        ? 'Nenhum campo ou timestamp.'
        : plan
          ? plan.changedFields
              .map((f) => (f === 'content' ? 'Markdown completo' : 'tags'))
              .join(', ') + '; timestamp local da nota.'
          : 'Somente a nota selecionada: versão anterior, com novo timestamp local. Outras entidades e rascunhos permanecem intactos.'
  return (
    <EntrySheet
      title={mode === 'history' ? 'Histórico Lumen' : 'Importar do Lumen'}
      description="Transferência manual de uma nota. Não conclui tarefas, registra tempo ou autoriza outras ações."
      onClose={close}
      dismissDisabled={state.writing}
      initialFocus={mode === 'history' ? cancelRef : fileRef}
      className="lumen-transfer-sheet"
    >
      {activeLumenTestSession && (
        <p className="form-help">
          AMBIENTE FICTÍCIO — sessão {activeLumenTestSession}. Banco
          atlas-lumen-test-{activeLumenTestSession} em 127.0.0.1:4189.
        </p>
      )}
      <p className="form-help">{historyNotice}</p>
      <div className="lumen-transfer-flow" aria-busy={state.busy}>
        {mode === 'import' && !confirming && (
          <label className="note-form">
            Selecionar pacote .lumen-atlas.json
            <input
              ref={fileRef}
              type="file"
              accept=".lumen-atlas.json,application/json"
              disabled={state.busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null
                void session.select(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        )}
        {state.file && (
          <p className="form-help lumen-long">
            Arquivo selecionado: {state.file.name}
          </p>
        )}
        {state.message && (
          <p ref={resultRef} tabIndex={-1} role="status">
            {state.message}
          </p>
        )}
        {state.error && (
          <p className="data-error" role="alert">
            {lumenMessage(state.error)}
          </p>
        )}
        {plan && proposed && (
          <>
            <h2>
              {confirming ? 'Confirmar importação' : 'Plano da importação'}
            </h2>
            <dl className="lumen-transfer-summary">
              <dt>Nota</dt>
              <dd>{proposed.title}</dd>
              <dt>Identidade</dt>
              <dd>{plan.integrationId}</dd>
              <dt>Operação</dt>
              <dd>{operationLabel[plan.operation]}</dd>
              <dt>Campos afetados</dt>
              <dd>{changed}</dd>
              <dt>SHA-256 do pacote</dt>
              <dd>{proposed.package_sha256}</dd>
              <dt>Baseline informado</dt>
              <dd>
                {proposed.baseline_sha256 ??
                  'Nenhum — criação ou reimportação, conforme o plano.'}
              </dd>
            </dl>
            {plan.conflicts.length > 0 && (
              <section aria-label="Conflitos bloqueantes">
                <h3>Conflitos bloqueantes</h3>
                <ul>
                  {plan.conflicts.map((code) => (
                    <li key={code}>{lumenMessage(code)}</li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Avisos">
              <h3>Avisos</h3>
              <ul>
                {plan.warnings.map((code) => (
                  <li key={code}>{lumenMessage(code)}</li>
                ))}
              </ul>
            </section>
            <Differences
              before={state.current}
              title={proposed.title}
              tags={proposed.tags}
              content={proposed.markdown}
            />
            {confirming && (
              <p>
                Confira a nota, os campos, as diferenças e os avisos acima. Ao
                confirmar, somente a operação indicada será executada. A nota
                completa será armazenada como texto; wikilinks podem não
                encontrar seus destinos no Atlas.
              </p>
            )}
          </>
        )}
        {state.phase === 'history' && (
          <>
            <h2>Operações registradas</h2>
            <ul className="lumen-history-list">
              {state.history.map((entry) => (
                <li key={entry.operation_id}>
                  <strong>{entry.after.title}</strong>
                  <span>
                    {entry.kind === 'create'
                      ? 'Criação — sem versão anterior; não exclui a nota.'
                      : 'Atualização — versão anterior registrada.'}
                  </span>
                  <span className="form-help">
                    {entry.applied_at} ·{' '}
                    {entry.restored_at ? 'Já restaurada' : 'Não restaurada'}
                  </span>
                  <span className="form-help lumen-long">
                    {entry.operation_id}
                  </span>
                  <button
                    className="button"
                    disabled={
                      state.busy || !entry.before || Boolean(entry.restored_at)
                    }
                    onClick={() =>
                      void session.selectRestore(entry.operation_id)
                    }
                  >
                    Ver versão recuperável
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="button"
              disabled={state.busy}
              onClick={() => void session.loadHistory()}
            >
              Conferir histórico novamente
            </button>
          </>
        )}
        {restore && (
          <>
            <h2>
              {confirming ? 'Confirmar restauração' : 'Versão recuperável'}
            </h2>
            <p className="lumen-long">
              Operação: {restore.operationId} · Nota: {restore.integrationId}
            </p>
            <p>
              Efeito: {changed} A versão atual deve corresponder exatamente à
              registrada, e a nota não pode ter rascunho.
            </p>
            <Differences
              before={state.current}
              title={restore.before.title}
              tags={restore.before.tags}
              content={restore.before.content}
            />
          </>
        )}
        <div className="lumen-transfer-actions">
          {plan && plan.operation !== 'conflict' && !confirming && (
            <button
              className="button button-primary"
              disabled={state.busy}
              onClick={session.review}
            >
              Revisar importação
            </button>
          )}
          {restore && !confirming && (
            <button
              className="button button-primary"
              disabled={state.busy}
              onClick={session.reviewRestore}
            >
              Revisar restauração
            </button>
          )}
          <button
            ref={cancelRef}
            className="button"
            disabled={state.writing}
            onClick={() => {
              if (state.phase === 'result') close()
              else session.cancel()
            }}
          >
            {state.phase === 'result' ? 'Fechar resultado' : 'Cancelar'}
          </button>
          {confirming && (
            <button
              className="button"
              disabled={state.busy}
              onClick={session.back}
            >
              Voltar à prévia
            </button>
          )}
          {state.phase === 'confirm' && (
            <button
              className="button button-primary"
              disabled={state.busy}
              onClick={() => void session.confirm()}
            >
              Confirmar importação
            </button>
          )}
          {state.phase === 'restore-confirm' && (
            <button
              className="button button-primary"
              disabled={state.busy}
              onClick={() => void session.confirmRestore()}
            >
              Confirmar restauração
            </button>
          )}
        </div>
      </div>
    </EntrySheet>
  )
}
function Differences({
  before,
  title,
  tags,
  content,
}: {
  before: Note | null
  title: string
  tags: readonly string[]
  content: string
}) {
  return (
    <section aria-label="Diferenças" className="lumen-differences">
      <h3>Diferenças e conteúdo completo</h3>
      <p>
        {before
          ? (before.title === title
              ? 'Título preservado: '
              : 'Título proposto: ') + title
          : 'Nova nota: ' + title}
      </p>
      <p className="lumen-long">
        Tags atuais: {before ? JSON.stringify(before.tags) : 'Nota inexistente'}
      </p>
      <p className="lumen-long">Tags propostas: {JSON.stringify(tags)}</p>
      <div className="lumen-diff-columns">
        {before && (
          <label>
            Markdown atual
            <textarea
              className="note-textarea"
              readOnly
              value={before.content}
              rows={9}
              spellCheck={false}
            />
          </label>
        )}
        <label>
          Markdown proposto (inclui YAML)
          <textarea
            className="note-textarea"
            readOnly
            value={content}
            rows={9}
            spellCheck={false}
          />
        </label>
      </div>
      <p className="form-help">
        Prévia inerte: seleção, cópia e rolagem disponíveis. HTML, código, links
        e embeds não são executados e nenhum recurso externo é carregado.
      </p>
    </section>
  )
}
