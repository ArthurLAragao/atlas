import { TransientToast } from '../../components/TransientToast'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Subject, StudyPath } from '../../data/models'
import { PageHeader } from '../../components/PageHeader'
import { eventCountdown, nextStudyEvent, pathProgress } from '../../lib/study'
import { searchKey } from '../../lib/search'
import { StudyEditor, type StudyKind } from './StudyEditors'
import { SubjectDetail } from './SubjectDetail'
import { PathDetail } from './PathDetail'
import { AssessmentForm } from './AssessmentForm'
import { StepEventForm } from './StepEventForm'
import { StudyCapture } from './StudyCapture'
import { StudyRelationForm } from './StudyRelations'
import { useStudy, studyChange } from './study-store'
import { StudyList } from './StudyList'
import { Flashcards } from './Flashcards'
import '../../styles/directions.css'
import '../../styles/study.css'

type Sheet =
  | { type: 'subject'; item?: Subject }
  | { type: 'path'; item?: StudyPath }
  | {
      type: 'assessment'
      subject: Subject
      item?: Subject['assessments'][number]
    }
  | { type: 'event'; subject: Subject; item?: Subject['events'][number] }
  | { type: 'step'; path: StudyPath; item?: StudyPath['steps'][number] }
  | {
      type: 'capture'
      kind: StudyKind
      id: string
      eventId?: string
      stepId?: string
      title?: string
    }
  | {
      type: 'relation'
      kind: StudyKind
      item: Subject | StudyPath
      target: 'tasks' | 'notes'
    }
function studyHref(kind: StudyKind, id: string) {
  return `/estudos?${kind === 'subjects' ? 'subject' : 'path'}=${encodeURIComponent(id)}`
}
function headingFocus() {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>('main h1')?.focus(),
  )
}
export default function StudyPage() {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const feedback = useStudy()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)
  const subject = data.subjects.find(
    (item) => item.id === params.get('subject'),
  )
  const path = subject
    ? undefined
    : data.studyPaths.find((item) => item.id === params.get('path'))
  const upcoming = nextStudyEvent(data.subjects, new Date())
  const nextPaths = data.studyPaths
    .filter((item) => item.status === 'active')
    .map((item) => ({ path: item, next: pathProgress(item).next }))
    .filter((item) => item.next)
  const nextPath = nextPaths[0]
  const needle = searchKey(query)
  const matches = (item: Subject | StudyPath) =>
    (item.status === 'archived') === archived &&
    searchKey(
      `${item.title} ${item.tags.join(' ')} ${'notes' in item ? item.notes : item.description}`,
    ).includes(needle)
  useEffect(() => {
    void useStudy.getState().refreshUndo()
  }, [])
  const open = (value: Sheet) => {
    feedback.dismiss()
    setSheet(value)
  }
  const saved = (kind: StudyKind, id: string) => {
    setSheet(null)
    navigate(studyHref(kind, id))
    headingFocus()
  }
  const removed = () => {
    navigate('/estudos')
    headingFocus()
  }
  async function undoStudy() {
    const info = feedback.undoInfo
    if (
      await studyChange(() => repository.undoStudyChange(), 'Ação desfeita.')
    ) {
      if (info) navigate(studyHref(info.type, info.id))
      headingFocus()
    }
  }
  return (
    <div className="directions-page study-page">
      {(feedback.message || feedback.error) && (
        <TransientToast
          identity={`${feedback.message}:${feedback.error}`}
          persistent={Boolean(feedback.error)}
          onDismiss={feedback.dismiss}
        >
          <p
            role={feedback.error ? 'alert' : 'status'}
            className={feedback.error ? 'data-error' : ''}
          >
            {feedback.error ||
              feedback.message ||
              `Você pode desfazer: ${feedback.undoInfo?.label}.`}
          </p>
          {feedback.undoInfo && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void undoStudy()}
            >
              Desfazer
            </button>
          )}
        </TransientToast>
      )}
      {subject ? (
        <SubjectDetail
          subject={subject}
          onEdit={() => open({ type: 'subject', item: subject })}
          onAssessment={(item) => open({ type: 'assessment', subject, item })}
          onEvent={(item) => open({ type: 'event', subject, item })}
          onTask={(item) =>
            open({
              type: 'capture',
              kind: 'subjects',
              id: subject.id,
              eventId: item?.id,
              title: item?.title,
            })
          }
          onLink={(target) =>
            open({ type: 'relation', kind: 'subjects', item: subject, target })
          }
          onRemoved={removed}
        />
      ) : path ? (
        <PathDetail
          path={path}
          onEdit={() => open({ type: 'path', item: path })}
          onStep={(item) => open({ type: 'step', path, item })}
          onTask={(item) =>
            open({
              type: 'capture',
              kind: 'studyPaths',
              id: path.id,
              stepId: item?.id,
              title: item?.title,
            })
          }
          onLink={(target) =>
            open({ type: 'relation', kind: 'studyPaths', item: path, target })
          }
          onRemoved={removed}
        />
      ) : (
        <>
          <PageHeader title="Estudos" eyebrow="Aprender, praticar, avançar">
            Um próximo passo para a faculdade e suas trilhas técnicas.
          </PageHeader>
          {(params.has('subject') || params.has('path')) && (
            <p role="status">
              Este estudo não está disponível. Escolha outra disciplina ou
              trilha.
            </p>
          )}
          <div className="study-priorities">
            <div className="study-next-actions">
              {upcoming ? (
                <section
                  className="study-next"
                  aria-label="Próximo compromisso de estudo"
                >
                  <span className="eyebrow">Próxima prova ou entrega</span>
                  <Link
                    className="study-next-title"
                    to={studyHref('subjects', upcoming.subject.id)}
                  >
                    {upcoming.event.title}
                  </Link>
                  <p>
                    <CalendarClock aria-hidden="true" />{' '}
                    {upcoming.subject.title} ·{' '}
                    {eventCountdown(upcoming.event, new Date()).label}
                  </p>
                </section>
              ) : (
                <p className="direction-help">
                  Sem provas ou entregas futuras. Anote uma data na sua
                  disciplina para planejar com calma.
                </p>
              )}
              {nextPath && (
                <section
                  className="study-next"
                  aria-label="Próxima etapa de estudo"
                >
                  <span className="eyebrow">Um pequeno próximo passo</span>
                  <Link
                    className="study-next-title"
                    to={studyHref('studyPaths', nextPath.path.id)}
                  >
                    {nextPath.next?.title}
                  </Link>
                  <p className="caption">{nextPath.path.title}</p>
                </section>
              )}
            </div>
            <Flashcards />
          </div>
          <div className="direction-actions">
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => open({ type: 'subject' })}
            >
              Nova disciplina
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => open({ type: 'path' })}
            >
              Nova trilha
            </button>
          </div>
          <div className="direction-filters">
            <label className="direction-field">
              Buscar estudos
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="direction-field">
              Mostrar estudos
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
          <section className="direction-section">
            <h2>Disciplinas</h2>
            <StudyList items={data.subjects.filter(matches)} kind="subjects" />
            {!data.subjects.filter(matches).length && (
              <p className="direction-help">
                {needle || archived
                  ? 'Nenhuma disciplina aqui. Ajuste os filtros.'
                  : 'Crie uma disciplina e anote a próxima avaliação.'}
              </p>
            )}
          </section>
          <section className="direction-section">
            <h2>Trilhas de estudo</h2>
            <StudyList
              items={data.studyPaths.filter(matches)}
              kind="studyPaths"
            />
            {!data.studyPaths.filter(matches).length && (
              <p className="direction-help">
                {needle || archived
                  ? 'Nenhuma trilha aqui. Ajuste os filtros.'
                  : 'Escolha um tema e adicione uma primeira etapa pequena.'}
              </p>
            )}
            {data.studyPaths.filter((item) => item.status === 'active').length >
              0 && (
              <details className="study-next-summary">
                <summary>Próximos passos das trilhas</summary>
                <p className="direction-help">
                  {data.studyPaths
                    .filter((item) => item.status === 'active')
                    .map((item) =>
                      pathProgress(item).next
                        ? `${item.title}: ${pathProgress(item).next?.title}`
                        : '',
                    )
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(' · ')}
                </p>
              </details>
            )}
          </section>
        </>
      )}
      {feedback.undoInfo && !feedback.message && !feedback.error && (
        <details className="direction-section">
          <summary>Última ação em estudos</summary>
          <button
            className="button"
            disabled={busy}
            onClick={() => void undoStudy()}
          >
            Desfazer
          </button>
        </details>
      )}
      {sheet?.type === 'subject' && (
        <StudyEditor
          kind="subjects"
          subject={sheet.item}
          onClose={() => setSheet(null)}
          onSaved={(id) => saved('subjects', id)}
        />
      )}
      {sheet?.type === 'path' && (
        <StudyEditor
          kind="studyPaths"
          path={sheet.item}
          onClose={() => setSheet(null)}
          onSaved={(id) => saved('studyPaths', id)}
        />
      )}
      {sheet?.type === 'assessment' && (
        <AssessmentForm
          subject={sheet.subject}
          assessment={sheet.item}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'event' && (
        <StepEventForm
          subject={sheet.subject}
          event={sheet.item}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'step' && (
        <StepEventForm
          path={sheet.path}
          step={sheet.item}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'capture' && (
        <StudyCapture
          kind={sheet.kind}
          id={sheet.id}
          eventId={sheet.eventId}
          stepId={sheet.stepId}
          initialTitle={sheet.title}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'relation' && (
        <StudyRelationForm
          kind={sheet.kind}
          item={sheet.item}
          target={sheet.target}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
