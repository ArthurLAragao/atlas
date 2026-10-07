import { useState } from 'react'
import { useData } from '../../app/data-store'
import { EntrySheet } from '../../components/EntrySheet'
import { flashcardSchema, type Flashcard } from '../../data/models'
import { repository } from '../../data/service'
import { initialReview } from '../../lib/sm2'
import { useActiveForm } from '../goals/use-active-form'
import { base, text, tags } from './StudyForm'
import { learningChange, useLearning } from './learning-store'

export function FlashcardForm({
  card,
  onClose,
}: {
  card?: Flashcard
  onClose: () => void
}) {
  const data = useData((state) => state.data)
  const busy = useData((state) => state.busy)
  const error = useLearning((state) => state.error)
  const [invalid, setInvalid] = useState('')
  const active = useActiveForm()
  return (
    <EntrySheet
      title={card ? 'Editar flashcard' : 'Novo flashcard'}
      description="Uma pergunta pequena. Uma resposta que você quer lembrar."
      onClose={onClose}
    >
      <form
        className="direction-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy) return
          const values = new FormData(event.currentTarget)
          const links: Flashcard['links'] = (card?.links ?? []).filter(
            (link) => !['notes', 'subjects', 'studyPaths'].includes(link.type),
          )
          for (const type of ['notes', 'subjects', 'studyPaths'] as const) {
            const id = text(values, type)
            if (id) links.push({ type, id })
          }
          const result = flashcardSchema.safeParse({
            ...(card ?? base()),
            question: text(values, 'question'),
            answer: text(values, 'answer'),
            tags: tags(values),
            links,
            status: text(values, 'status'),
            review: card?.review ?? initialReview(new Date()),
          })
          if (!result.success) {
            setInvalid(
              'Preencha pergunta e resposta. Use até 50 tags de 60 caracteres, separadas por vírgula.',
            )
            return
          }
          setInvalid('')
          void learningChange(
            () =>
              repository.saveFlashcard(result.data, card?.updatedAt ?? null),
            'Flashcard salvo.',
          ).then((ok) => {
            if (ok && active.current) onClose()
          })
        }}
      >
        <fieldset disabled={busy} className="direction-form">
          <label>
            Pergunta
            <textarea
              name="question"
              autoFocus
              required
              maxLength={10000}
              defaultValue={card?.question}
            />
          </label>
          <label>
            Resposta
            <textarea
              name="answer"
              required
              maxLength={50000}
              defaultValue={card?.answer}
            />
          </label>
          <details>
            <summary>Vínculos, tags e revisão</summary>
            <div className="direction-form">
              {(['notes', 'subjects', 'studyPaths'] as const).map((kind) => (
                <label key={kind}>
                  {kind === 'notes'
                    ? 'Nota vinculada'
                    : kind === 'subjects'
                      ? 'Disciplina vinculada'
                      : 'Trilha vinculada'}
                  <select
                    name={kind}
                    defaultValue={
                      card?.links.find((link) => link.type === kind)?.id ?? ''
                    }
                  >
                    <option value="">Sem vínculo</option>
                    {data[kind].map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Tags
                <input
                  name="tags"
                  defaultValue={card?.tags.join(', ')}
                  maxLength={4000}
                />
              </label>
              <label>
                Revisão
                <select name="status" defaultValue={card?.status ?? 'active'}>
                  <option value="active">Ativa</option>
                  <option value="suspended">Suspensa</option>
                </select>
              </label>
            </div>
          </details>
        </fieldset>
        {(invalid || error) && (
          <p className="data-error" role="alert">
            {invalid || error} Seu texto continua aqui.
          </p>
        )}
        <div className="direction-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            Salvar flashcard
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
