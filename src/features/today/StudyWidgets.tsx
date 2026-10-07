import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { nextStudyEvent, eventCountdown } from '../../lib/study'
import { dueCards } from '../../lib/sm2'
import { widgetNames, type WidgetId } from '../../lib/widgets'

export function StudyWidget({
  id,
  now,
}: {
  id: Extract<WidgetId, 'exam' | 'path' | 'flashcards' | 'focus'>
  now: Date
}) {
  const data = useData((state) => state.data)
  const event = nextStudyEvent(data.subjects, now)
  const path = data.studyPaths.find(
    (item) => item.status === 'active' && item.steps.some((step) => !step.done),
  )
  const step = path?.steps.find((item) => !item.done)
  const due = dueCards(data.flashcards, now)
  const focus = data.focusSessions.find((item) => item.status === 'in-progress')
  return (
    <section className="today-section" aria-labelledby={`today-${id}`}>
      <h2 id={`today-${id}`}>{widgetNames[id]}</h2>
      {id === 'exam' &&
        (event ? (
          <>
            <h3>{event.event.title}</h3>
            <p>
              {event.subject.title} · {eventCountdown(event.event, now).label}
            </p>
            <Link
              className="today-link"
              to={`/estudos?subject=${encodeURIComponent(event.subject.id)}`}
            >
              Abrir disciplina
            </Link>
          </>
        ) : (
          <>
            <p className="today-empty">
              Sem provas ou entregas futuras. Anote uma data em Estudos.
            </p>
            <Link className="today-link" to="/estudos">
              Planejar em Estudos
            </Link>
          </>
        ))}
      {id === 'path' &&
        (path && step ? (
          <>
            <h3>{step.title}</h3>
            <p>
              {path.title}
              {step.estimatedMinutes
                ? ` · ${step.estimatedMinutes} min estimados`
                : ''}
            </p>
            <Link
              className="today-link"
              to={`/estudos?path=${encodeURIComponent(path.id)}`}
            >
              Dar o próximo passo
            </Link>
          </>
        ) : (
          <>
            <p className="today-empty">
              Escolha uma trilha e defina uma etapa pequena para começar.
            </p>
            <Link className="today-link" to="/estudos">
              Ver trilhas
            </Link>
          </>
        ))}
      {id === 'flashcards' && (
        <>
          <p>
            {due.length
              ? `${due.length} ${due.length === 1 ? 'cartão para revisar' : 'cartões para revisar'}. Comece por uma pergunta.`
              : 'Revisão em dia. Crie uma pergunta sobre o que está aprendendo.'}
          </p>
          <Link className="today-link" to="/estudos">
            {due.length ? 'Revisar agora' : 'Criar flashcard'}
          </Link>
        </>
      )}
      {id === 'focus' && (
        <>
          <p>
            {focus
              ? `Sessão em andamento: ${focus.title}.`
              : 'Reserve um tempo para uma coisa de cada vez.'}
          </p>
          <Link className="button" to="/foco">
            {focus ? 'Retomar sessão' : 'Abrir modo Foco'}
          </Link>
        </>
      )}
    </section>
  )
}
