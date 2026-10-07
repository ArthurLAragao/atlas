import { addDays, format, parseISO, isValid } from 'date-fns'
import { reviewSchema, type Flashcard, type ReviewState } from '../data/models.js'

export const recallLabels = [
  'Não lembrei',
  'Reconheci a resposta',
  'Quase lembrei',
  'Lembrei com esforço',
  'Lembrei com hesitação',
  'Lembrei facilmente',
] as const
export function initialReview(now: Date): ReviewState {
  return reviewSchema.parse({
    repetitions: 0,
    interval: 0,
    easiness: 2.5,
    nextReview: format(now, 'yyyy-MM-dd'),
    quality: null,
    lastReviewedAt: null,
  })
}
/** Small SM-2 variant: one review per day; failures return tomorrow, no same-day drill.
 * Intervals use the previous ease, ceil rounding, and calendar days. See docs/DECISIONS.md. */
export function reviewCard(
  state: ReviewState,
  quality: number,
  now: Date,
): ReviewState {
  reviewSchema.parse(state)
  if (!Number.isInteger(quality) || quality < 0 || quality > 5 || !isValid(now))
    throw new RangeError('Avalie a recordação de 0 a 5 e use uma data válida.')
  const repetitions =
    quality < 3 ? 0 : Math.min(1_000_000, state.repetitions + 1)
  const interval =
    quality < 3 || repetitions === 1
      ? 1
      : repetitions === 2
        ? 6
        : Math.max(
            1,
            Math.min(36_500, Math.ceil(state.interval * state.easiness)),
          )
  const easiness = Math.min(
    10,
    Math.max(
      1.3,
      Math.round(
        (state.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)) *
          100,
      ) / 100,
    ),
  )
  return reviewSchema.parse({
    repetitions,
    interval,
    easiness,
    nextReview: format(
      addDays(parseISO(format(now, 'yyyy-MM-dd')), interval),
      'yyyy-MM-dd',
    ),
    quality,
    lastReviewedAt: now.toISOString(),
  })
}
export function dueCards(cards: readonly Flashcard[], now: Date): Flashcard[] {
  const today = format(now, 'yyyy-MM-dd')
  return cards
    .filter(
      (card) => card.status === 'active' && card.review.nextReview <= today,
    )
    .sort(
      (a, b) =>
        a.review.nextReview.localeCompare(b.review.nextReview) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
}
