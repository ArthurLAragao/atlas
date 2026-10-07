import { ConfirmAction } from '../../components/ConfirmAction'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/data-store'
import { repository } from '../../data/service'
import type { Flashcard } from '../../data/models'
import { dueCards, recallLabels } from '../../lib/sm2'
import { FlashcardForm } from './FlashcardForm'
import {
  learningChange,
  refreshLearningUndo,
  useLearning,
} from './learning-store'

function ReviewCard({
  card,
  onEdit,
  afterReview,
}: {
  card: Flashcard
  onEdit: () => void
  afterReview: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const busy = useData((state) => state.busy)
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !revealed ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !/^[0-5]$/.test(event.key) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          ))
      )
        return
      event.preventDefault()
      void learningChange(
        () =>
          repository.reviewFlashcard(
            card.id,
            Number(event.key),
            card.updatedAt,
          ),
        'Recordação salva. Próximo cartão.',
      ).then((ok) => {
        if (ok) afterReview()
      })
    }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [card, revealed, afterReview])
  return (
    <div className="flashcard-reading">
      <h3>{card.question}</h3>
      {revealed ? (
        <>
          <p className="flashcard-answer">{card.answer}</p>
          <fieldset className="recall-options">
            <legend>Como foi lembrar? Use as teclas 0–5.</legend>
            {recallLabels.map((label, quality) => (
              <button
                className="button"
                key={quality}
                disabled={busy}
                aria-label={`${quality} — ${label}`}
                onClick={() =>
                  void learningChange(
                    () =>
                      repository.reviewFlashcard(
                        card.id,
                        quality,
                        card.updatedAt,
                      ),
                    'Recordação salva. Próximo cartão.',
                  ).then((ok) => {
                    if (ok) afterReview()
                  })
                }
              >
                <span className="direction-number">{quality}</span> {label}
              </button>
            ))}
          </fieldset>
        </>
      ) : (
        <button
          data-reveal-answer
          className="button button-primary"
          onClick={() => setRevealed(true)}
        >
          Revelar resposta
        </button>
      )}
      <div className="direction-actions">
        <button className="button" disabled={busy} onClick={onEdit}>
          Editar flashcard
        </button>
        <ConfirmAction
          name={card.question}
          title="Excluir este flashcard?"
          description="Esta ação remove o cartão e seu estado de revisão. Você poderá desfazer."
          className="button"
          disabled={busy}
          onConfirm={() =>
            void learningChange(
              () => repository.removeFlashcard(card.id),
              'Flashcard excluído. Você pode desfazer.',
              {
                ...useData.getState().data,
                flashcards: useData
                  .getState()
                  .data.flashcards.filter((item) => item.id !== card.id),
              },
            ).then((ok) => {
              if (ok) afterReview()
            })
          }
        >
          Excluir flashcard
        </ConfirmAction>
      </div>
      <div className="direction-actions">
        {card.links.map((link) =>
          link.type === 'notes' ||
          link.type === 'subjects' ||
          link.type === 'studyPaths' ? (
            <Link
              className="direction-external"
              key={`${link.type}-${link.id}`}
              to={
                link.type === 'notes'
                  ? `/notas?note=${encodeURIComponent(link.id)}`
                  : `/estudos?${link.type === 'subjects' ? 'subject' : 'path'}=${encodeURIComponent(link.id)}`
              }
            >
              Abrir{' '}
              {link.type === 'notes'
                ? 'nota'
                : link.type === 'subjects'
                  ? 'disciplina'
                  : 'trilha'}
            </Link>
          ) : null,
        )}
      </div>
    </div>
  )
}
export function Flashcards() {
  const cards = useData((state) => state.data.flashcards)
  const busy = useData((state) => state.busy)
  const feedback = useLearning()
  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null)
  const [selected, setSelected] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const due = dueCards(cards, new Date())
  const card = due[0]
  useEffect(() => {
    void refreshLearningUndo()
  }, [])
  const afterReview = () =>
    requestAnimationFrame(() => {
      if (!heading.current?.isConnected) return
      ;(
        document.querySelector<HTMLElement>('[data-reveal-answer]') ??
        heading.current
      )?.focus()
    })
  return (
    <section
      className="direction-section flashcards-section"
      aria-labelledby="flashcards-title"
    >
      <div className="direction-section-heading">
        <h2 id="flashcards-title" tabIndex={-1} ref={heading}>
          Para revisar hoje
        </h2>
        <span className="caption">
          {due.length} {due.length === 1 ? 'cartão' : 'cartões'}
        </span>
      </div>
      {(feedback.error || feedback.message) && (
        <p
          role={feedback.error ? 'alert' : 'status'}
          className={feedback.error ? 'data-error' : 'direction-help'}
        >
          {feedback.error || feedback.message}
        </p>
      )}
      {feedback.canUndo && (
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void learningChange(
              () => repository.undoFlashcard(),
              'Flashcard recuperado.',
            ).then((ok) => {
              if (ok) afterReview()
            })
          }
        >
          Desfazer exclusão do flashcard
        </button>
      )}
      {card ? (
        <ReviewCard
          key={`${card.id}-${card.updatedAt}`}
          card={card}
          onEdit={() => {
            useLearning.setState({ error: '', message: '' })
            setEditing(card)
          }}
          afterReview={afterReview}
        />
      ) : (
        <p className="direction-help">
          {cards.length
            ? 'Revisão de hoje em dia. Volte na próxima data ou anote uma nova pergunta.'
            : 'Guarde uma pergunta da aula para revisar em poucos minutos.'}
        </p>
      )}
      <button
        className="button"
        disabled={busy}
        onClick={() => {
          useLearning.setState({ error: '', message: '' })
          setEditing('new')
        }}
      >
        Novo flashcard
      </button>
      {!!cards.length && (
        <details className="flashcard-manage">
          <summary>Editar um cartão ou retomar a revisão suspensa</summary>
          <label className="direction-field">
            Cartão
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Escolha um cartão</option>
              {cards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.question.slice(0, 100)} ·{' '}
                  {item.status === 'suspended'
                    ? 'Suspenso'
                    : item.review.nextReview.split('-').reverse().join('/')}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={busy || !cards.some((item) => item.id === selected)}
            onClick={() => {
              const found = cards.find((item) => item.id === selected)
              if (found) {
                useLearning.setState({ error: '', message: '' })
                setEditing(found)
              }
            }}
          >
            Editar cartão selecionado
          </button>
        </details>
      )}
      {editing && (
        <FlashcardForm
          card={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  )
}
