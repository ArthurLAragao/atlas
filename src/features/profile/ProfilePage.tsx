import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lock,
  Pencil,
  Check,
  Timer,
  BookOpen,
  Activity,
  Pin,
} from 'lucide-react'
import { useData } from '../../app/data-store'
import { defaultProfile } from '../../data/profile-models'
import {
  activityEvents,
  activityMetrics,
  activityHref,
} from '../../lib/activity'
import { dateKey } from '../../lib/habits'
import {
  goalProgress,
  goalStatusLabels,
  projectStatusLabels,
  goalStatus,
  projectStatus,
} from '../../lib/goals'
import { pathProgress } from '../../lib/study'
import { PageHeader } from '../../components/PageHeader'
import { ActivityHeatmap } from './ActivityHeatmap'
import { PinButton } from './PinButton'
import '../../styles/habits.css'
import '../../styles/profile.css'
const ProfileForm = lazy(() =>
  import('./ProfileForm').then((m) => ({ default: m.ProfileForm })),
)
export default function ProfilePage() {
  const data = useData((s) => s.data),
    profile = data.profile ?? defaultProfile(),
    today = dateKey(new Date())
  const [editing, setEditing] = useState(false),
    [filter, setFilter] = useState('all'),
    [failedAvatar, setFailedAvatar] = useState<string | null>(null)
  const events = useMemo(() => activityEvents(data), [data]),
    metrics = useMemo(() => activityMetrics(data, today), [data, today])
  const recent = events
    .filter(
      (e) =>
        e.date <= today &&
        (filter === 'all' ||
          (filter === 'study'
            ? ['step', 'flashcard'].includes(e.kind)
            : filter === e.kind)),
    )
    .slice(0, 10)
  const pinned = profile.pinned.flatMap((pin) => {
    const item = data[pin.type].find((i) => i.id === pin.id)
    return item ? [{ ...pin, item }] : []
  })
  const unavailable = profile.pinned.filter(
    (pin) => !data[pin.type].some((item) => item.id === pin.id),
  )
  return (
    <div className="profile-page">
      <div className="profile-header">
        <span className="profile-privacy">
          <Lock aria-hidden="true" />
          Local e privado
        </span>
        <div className="profile-avatar" data-style={profile.avatarStyle}>
          {profile.avatar && profile.avatar !== failedAvatar ? (
            <img
              src={profile.avatar}
              alt="Seu avatar"
              onError={() => setFailedAvatar(profile.avatar)}
            />
          ) : (
            <span aria-hidden="true">
              {profile.name
                .trim()
                .split(/\s+/)
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toLocaleUpperCase('pt-BR') || 'A'}
            </span>
          )}
        </div>
        <PageHeader
          title={profile.name || 'Personalize seu espaço'}
          eyebrow="Meu espaço"
        >
          {profile.handle
            ? profile.handle.startsWith('@')
              ? profile.handle
              : `@${profile.handle}`
            : 'Seu centro de comando, do seu jeito.'}
        </PageHeader>
        {profile.bio && <p>{profile.bio}</p>}
        <button className="button" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Editar perfil
        </button>
      </div>
      <dl className="profile-metrics">
        {[
          {
            value: metrics.current,
            label: 'Sequência atual',
            description:
              'Dias seguidos com uma ação; hoje pode ficar em aberto.',
            href: '#activity-title',
          },
          {
            value: metrics.best,
            label: 'Melhor sequência',
            description: 'Maior sequência no histórico disponível.',
            href: '#activity-title',
          },
          {
            value: metrics.tasks,
            label: 'Tarefas concluídas',
            description:
              'Tarefas pessoais concluídas e conclusões históricas registradas, uma vez por tarefa.',
            href: '/tarefas',
          },
          {
            value: `${Math.floor(metrics.focusMinutes / 60)} h ${Math.floor(metrics.focusMinutes % 60)} min`,
            label: 'Tempo de foco',
            description:
              'Tempo real de sessões encerradas, incluindo interrompidas; sem pausas.',
            href: '/foco',
          },
        ].map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>
              <a
                href={m.href}
                aria-label={`${m.label}: ${m.value}. ${m.description}`}
              >
                {m.value}
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <section className="profile-section">
        <h2>Em construção</h2>
        {pinned.length ? (
          <ul className="profile-pinned">
            {pinned.map(({ type, id, item }) => {
              const progress =
                'keyResults' in item
                  ? goalProgress(item).percent
                  : 'steps' in item
                    ? pathProgress(item).percent
                    : null
              const status =
                'keyResults' in item
                  ? goalStatusLabels[goalStatus(item)]
                  : 'urls' in item
                    ? projectStatusLabels[projectStatus(item)]
                    : item.status === 'active'
                      ? 'Ativa'
                      : item.status === 'completed'
                        ? 'Concluída'
                        : 'Arquivada'
              return (
                <li key={`${type}:${id}`}>
                  <Link
                    to={
                      type === 'studyPaths'
                        ? `/estudos?path=${id}`
                        : `/metas?${type === 'goals' ? 'goal' : 'project'}=${id}`
                    }
                  >
                    <Pin aria-hidden="true" />
                    <strong>{item.title}</strong>
                    <span>
                      {status}
                      {progress !== null ? ` · ${progress}%` : ''}
                    </span>
                  </Link>
                  {progress !== null && (
                    <progress
                      value={progress}
                      max={100}
                      aria-label={`Progresso de ${item.title}`}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="profile-empty">
            <p>Escolha até três direções que merecem sua atenção.</p>
            <Link className="button" to="/metas">
              Fixar algo importante
            </Link>
            <Link className="button" to="/estudos">
              Explorar trilhas
            </Link>
          </div>
        )}
      </section>
      {unavailable.length > 0 && (
        <section className="profile-section" aria-label="Fixados indisponíveis">
          <ul className="profile-pinned">
            {unavailable.map((pin) => (
              <li key={`${pin.type}:${pin.id}`}>
                <p>
                  {pin.type === 'projects'
                    ? 'Projeto'
                    : pin.type === 'goals'
                      ? 'Meta'
                      : 'Trilha'}{' '}
                  indisponível. Desfaça a exclusão no módulo para recuperar ou
                  retire do perfil.
                </p>
                <PinButton {...pin} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <ActivityHeatmap events={events} today={today} />
      <section className="profile-section">
        <h2>Atividade recente</h2>
        <div className="button-row" aria-label="Filtrar atividade">
          {[
            ['all', 'Tudo'],
            ['task', 'Tarefas'],
            ['habit', 'Hábitos'],
            ['focus', 'Foco'],
            ['study', 'Estudos'],
          ].map(([value, label]) => (
            <button
              className="button"
              key={value}
              aria-pressed={value === filter}
              onClick={() => setFilter(value!)}
            >
              {label}
            </button>
          ))}
        </div>
        {recent.length ? (
          <ol className="profile-recent">
            {recent.map((e) => {
              const Icon =
                e.kind === 'task'
                  ? Check
                  : e.kind === 'focus'
                    ? Timer
                    : e.kind === 'habit'
                      ? Activity
                      : BookOpen
              const href = activityHref(e, data),
                title = `${e.kind === 'task' ? 'Concluiu' : e.kind === 'habit' ? 'Registrou' : e.kind === 'focus' ? `Registrou ${Math.floor(e.value)} min de foco em` : e.kind === 'step' ? 'Concluiu etapa' : 'Revisou'} ${e.title}`
              return (
                <li key={e.key}>
                  <Icon aria-hidden="true" />
                  <div>
                    {href ? (
                      <Link to={href}>{title}</Link>
                    ) : (
                      <span>{title}</span>
                    )}
                    <time dateTime={e.at}>
                      {new Date(e.at).toLocaleString('pt-BR')}
                    </time>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="form-help">
            Seu progresso começa a aparecer aqui ao concluir uma tarefa,
            registrar um hábito, estudar ou focar.
          </p>
        )}
        <p className="form-help">
          Exemplos não contam. Datas antigas de conclusão sem histórico
          confiável não são inventadas.
        </p>
      </section>
      <Suspense fallback={<p role="status">Abrindo edição.</p>}>
        {editing && (
          <ProfileForm profile={profile} onClose={() => setEditing(false)} />
        )}
      </Suspense>
    </div>
  )
}
