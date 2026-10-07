import { useState, type FormEvent } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { useData } from '../../app/data-store'
import { projectSchema, type Project } from '../../data/models'
import { readNoteTags } from '../../lib/note-tags'
import { projectStatusLabels } from '../../lib/goals'
import { useDirections } from './direction-store'
import { useActiveForm } from './use-active-form'

export function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project?: Project
  onClose: () => void
  onSaved: (project: Project) => void
}) {
  const [title, setTitle] = useState(project?.title ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [status, setStatus] = useState(project?.status ?? 'planned')
  const [tags, setTags] = useState(project?.tags.join(', ') ?? '')
  const [repositoryUrl, setRepositoryUrl] = useState(
    project?.repositoryUrl ?? '',
  )
  const [urls, setUrls] = useState(project?.urls ?? [])
  const [error, setError] = useState('')
  const busy = useData((state) => state.busy)
  const active = useActiveForm()
  async function submit(event: FormEvent) {
    event.preventDefault()
    const now = new Date().toISOString()
    const parsed = projectSchema.safeParse({
      ...project,
      id: project?.id ?? crypto.randomUUID(),
      title,
      description,
      status,
      tags: readNoteTags(tags, project?.tags ?? []),
      repositoryUrl: repositoryUrl.trim() || null,
      urls,
      links: project?.links ?? [],
      createdAt: project?.createdAt ?? now,
      updatedAt: project?.updatedAt ?? now,
      isExample: false,
    })
    if (!parsed.success) {
      setError(
        'Confira título, tags e links. As URLs precisam começar com https:// ou http://.',
      )
      return
    }
    const saved = await useDirections
      .getState()
      .saveProject(parsed.data, project?.updatedAt ?? null)
    if (!active.current) return
    if (saved) onSaved(saved)
    else
      setError(
        useDirections.getState().error ??
          'Não foi possível salvar. Tente novamente.',
      )
  }
  return (
    <EntrySheet
      title={project ? 'Editar projeto' : 'Novo projeto'}
      description="Reúna ações e conhecimento em torno de algo que quer construir."
      onClose={onClose}
    >
      <form
        className="direction-form"
        onSubmit={(event) => void submit(event)}
        aria-busy={busy}
      >
        <label>
          Título do projeto
          <input
            autoFocus
            required
            maxLength={240}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          Estado do projeto
          <select
            value={status}
            disabled={busy}
            onChange={(event) =>
              setStatus(event.target.value as NonNullable<Project['status']>)
            }
          >
            {Object.entries(projectStatusLabels)
              .filter(([key]) => key !== 'archived')
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label>
          Descrição do projeto
          <textarea
            maxLength={50_000}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <details>
          <summary>Tags e links</summary>
          <div className="direction-form">
            <label>
              Tags do projeto
              <input
                maxLength={4000}
                value={tags}
                disabled={busy}
                placeholder="projetos, cloud"
                onChange={(event) => setTags(event.target.value)}
              />
            </label>
            <label>
              URL do repositório
              <input
                type="url"
                maxLength={2048}
                value={repositoryUrl}
                disabled={busy}
                placeholder="https://…"
                onChange={(event) => setRepositoryUrl(event.target.value)}
              />
            </label>
            {urls.map((url, index) => (
              <div className="direction-link-fields" key={index}>
                <label>
                  Título do link {index + 1}
                  <input
                    id={`project-url-${index}`}
                    required
                    maxLength={240}
                    value={url.title}
                    disabled={busy}
                    onChange={(event) =>
                      setUrls((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  URL do link {index + 1}
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={url.url}
                    disabled={busy}
                    onChange={(event) =>
                      setUrls((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, url: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  aria-label={`Remover link ${index + 1}`}
                  onClick={(event) => {
                    setUrls((current) =>
                      current.filter((_item, itemIndex) => itemIndex !== index),
                    )
                    ;(
                      event.currentTarget
                        .closest('details')
                        ?.querySelector(
                          '[data-add-url]',
                        ) as HTMLButtonElement | null
                    )?.focus()
                  }}
                >
                  Remover link
                </button>
              </div>
            ))}
            <button
              className="button"
              data-add-url
              type="button"
              disabled={busy || urls.length >= 100}
              onClick={() => {
                setUrls((current) => [...current, { title: '', url: '' }])
                requestAnimationFrame(() =>
                  document
                    .getElementById(`project-url-${urls.length}`)
                    ?.focus(),
                )
              }}
            >
              Adicionar link
            </button>
          </div>
        </details>
        {error && (
          <p className="data-error" role="alert">
            {error} Seu texto continua no formulário.
          </p>
        )}
        <div className="direction-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            disabled={busy || !title.trim()}
          >
            Salvar projeto
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
