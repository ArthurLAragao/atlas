import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { PageHeader } from '../../components/PageHeader'
import type { Goal, Project, Snapshot } from '../../data/models'
import { directionHref } from '../../lib/goals'
import { searchKey } from '../../lib/search'
import { useDirections } from './direction-store'
import { DirectionDetail } from './DirectionDetail'
import { DirectionFeedback } from './DirectionFeedback'
import { DirectionList } from './DirectionList'
import { GoalForm } from './GoalForm'
import { ProjectForm } from './ProjectForm'
import { RelationForm } from './RelationForm'
import { ProjectCaptureForm } from './ProjectCaptureForm'
import '../../styles/directions.css'

type Sheet =
  | { kind: 'goal'; goal?: Goal }
  | { kind: 'project'; project?: Project }
  | {
      kind: 'relation'
      type: 'goals' | 'projects'
      id: string
      target: 'tasks' | 'notes' | 'goals' | 'projects'
    }
  | { kind: 'capture'; projectId: string; type: 'task' | 'note' }
function headingFocus() {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>('main h1')?.focus(),
  )
}
function matches(
  item: Snapshot['goals'][number] | Snapshot['projects'][number],
  needle: string,
  archived: boolean,
) {
  return (
    (item.status === 'archived') === archived &&
    searchKey(
      `${item.title} ${item.description ?? ''} ${item.tags.join(' ')}`,
    ).includes(needle)
  )
}
export default function GoalsPage() {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const recovery = useDirections((state) =>
    !state.message && !state.error ? state.undoInfo : null,
  )
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState('all')
  const [archived, setArchived] = useState(false)
  const legacyId = location.hash.startsWith('#record-')
    ? decodeURIComponent(location.hash.slice(8))
    : undefined
  const goal = data.goals.find(
    (item) => item.id === (params.get('goal') ?? legacyId),
  )
  const project = goal
    ? undefined
    : data.projects.find(
        (item) => item.id === (params.get('project') ?? legacyId),
      )
  const item = goal ?? project
  const type = goal ? 'goals' : 'projects'
  const needle = searchKey(query)
  const goals = data.goals
    .filter((item) => matches(item, needle, archived))
    .sort(
      (a, b) =>
        Number(Boolean(b.weekly)) - Number(Boolean(a.weekly)) ||
        a.title.localeCompare(b.title, 'pt-BR'),
    )
  const projects = data.projects
    .filter((item) => matches(item, needle, archived))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  useEffect(() => {
    void useDirections.getState().refreshUndo()
  }, [])
  function saved(type: 'goals' | 'projects', id: string) {
    setSheet(null)
    navigate(directionHref(type, id))
    headingFocus()
  }
  function open(next: Sheet) {
    useDirections.getState().dismiss()
    setSheet(next)
  }
  return (
    <div className="directions-page">
      <DirectionFeedback />
      {item ? (
        <DirectionDetail
          key={item.id}
          type={type}
          item={item}
          onEdit={() =>
            open(goal ? { kind: 'goal', goal } : { kind: 'project', project })
          }
          onLink={(target) =>
            open({ kind: 'relation', type, id: item.id, target })
          }
          onCreate={(target) =>
            open({ kind: 'capture', projectId: item.id, type: target })
          }
          onRemoved={() => {
            navigate('/metas')
            headingFocus()
          }}
        />
      ) : (
        <>
          <PageHeader
            title="Metas e projetos"
            eyebrow="Dê direção aos próximos passos"
          >
            O que você faz hoje encontra o que quer construir.
          </PageHeader>
          {(params.has('goal') || params.has('project') || legacyId) && (
            <p role="status">
              Este registro não está disponível. Escolha outra meta ou projeto.
            </p>
          )}
          <div className="direction-actions">
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => open({ kind: 'goal' })}
            >
              Nova meta
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => open({ kind: 'project' })}
            >
              Novo projeto
            </button>
          </div>
          <fieldset className="segmented direction-collections">
            <legend className="sr-only">Coleção de metas e projetos</legend>
            {(
              [
                ['all', 'Tudo'],
                ['goals', 'Metas'],
                ['projects', 'Projetos'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="direction-collection"
                  value={value}
                  checked={collection === value}
                  onChange={() => setCollection(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div className="direction-filters">
            <label className="direction-field">
              Buscar metas e projetos
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="direction-field">
              Mostrar registros
              <select
                value={archived ? 'archived' : 'current'}
                onChange={(event) =>
                  setArchived(event.target.value === 'archived')
                }
              >
                <option value="current">Atuais e concluídos</option>
                <option value="archived">Arquivados</option>
              </select>
            </label>
          </div>
          <section
            className="direction-section"
            aria-labelledby="goals-list"
            hidden={collection === 'projects'}
          >
            <div className="direction-section-heading">
              <h2 id="goals-list">Metas</h2>
              <span className="caption">{goals.length}</span>
            </div>
            {goals.length ? (
              <DirectionList items={goals} label="Metas encontradas" />
            ) : (
              <p className="direction-help">
                {needle || archived
                  ? 'Nenhuma meta aqui. Ajuste a busca ou mostre os registros atuais.'
                  : 'Escolha o que quer alcançar. Crie uma meta e anote o primeiro resultado-chave.'}
              </p>
            )}
          </section>
          <section
            className="direction-section"
            aria-labelledby="projects-list"
            hidden={collection === 'goals'}
          >
            <div className="direction-section-heading">
              <h2 id="projects-list">Projetos</h2>
              <span className="caption">{projects.length}</span>
            </div>
            {projects.length ? (
              <DirectionList items={projects} label="Projetos encontrados" />
            ) : (
              <p className="direction-help">
                {needle || archived
                  ? 'Nenhum projeto aqui. Ajuste a busca ou mostre os registros atuais.'
                  : 'Dê um lugar às tarefas e ideias que caminham juntas. Crie seu primeiro projeto.'}
              </p>
            )}
          </section>
        </>
      )}
      {recovery && (
        <details className="direction-section">
          <summary>Última ação em metas e projetos</summary>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (await useDirections.getState().undo())
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>('[data-direction-recovered]')
                    ?.focus(),
                )
            }}
          >
            Desfazer: {recovery.label}
          </button>
        </details>
      )}
      {sheet?.kind === 'goal' && (
        <GoalForm
          goal={sheet.goal}
          onClose={() => setSheet(null)}
          onSaved={(value) => saved('goals', value.id)}
        />
      )}
      {sheet?.kind === 'project' && (
        <ProjectForm
          project={sheet.project}
          onClose={() => setSheet(null)}
          onSaved={(value) => saved('projects', value.id)}
        />
      )}
      {sheet?.kind === 'relation' && (
        <RelationForm
          type={sheet.type}
          id={sheet.id}
          targetType={sheet.target}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'capture' && (
        <ProjectCaptureForm
          projectId={sheet.projectId}
          kind={sheet.type}
          onClose={() => setSheet(null)}
          onCreated={(id) => {
            const current = sheet
            setSheet(null)
            if (current.type === 'note')
              navigate(`/notas?note=${encodeURIComponent(id)}&edit=1`)
            else {
              navigate(directionHref('projects', current.projectId))
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>('[data-edit-direction]')
                  ?.focus(),
              )
            }
          }}
        />
      )}
    </div>
  )
}
