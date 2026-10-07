import { describe, expect, it } from 'vitest'
import { dueCards, initialReview, reviewCard } from './sm2'
import { flashcardSchema, reviewSchema } from '../data/models'

const now = new Date(2026, 9, 3, 12)
describe('SM-2 pequeno do Atlas', () => {
  it('começa com facilidade 2,5, sem revisão e vence hoje', () => {
    expect(initialReview(now)).toEqual({
      repetitions: 0,
      interval: 0,
      easiness: 2.5,
      nextReview: '2026-10-03',
      quality: null,
      lastReviewedAt: null,
    })
  })
  it('intervalos 1, 6 e ceil(intervalo × facilidade anterior)', () => {
    const first = reviewCard(initialReview(now), 4, now)
    expect(first).toMatchObject({
      repetitions: 1,
      interval: 1,
      easiness: 2.5,
      nextReview: '2026-10-04',
    })
    const second = reviewCard(first, 5, new Date(2026, 9, 4, 12))
    expect(second).toMatchObject({
      repetitions: 2,
      interval: 6,
      easiness: 2.6,
      nextReview: '2026-10-10',
    })
    expect(reviewCard(second, 4, new Date(2026, 9, 10, 12))).toMatchObject({
      repetitions: 3,
      interval: 16,
      nextReview: '2026-10-26',
    })
  })
  it.each([0, 1, 2])(
    'qualidade %i reinicia sequência para amanhã',
    (quality) => {
      expect(
        reviewCard(
          { ...initialReview(now), repetitions: 8, interval: 99 },
          quality,
          now,
        ),
      ).toMatchObject({
        repetitions: 0,
        interval: 1,
        quality,
        nextReview: '2026-10-04',
      })
    },
  )
  it.each([
    [0, 1.7],
    [1, 1.96],
    [2, 2.18],
    [3, 2.36],
    [4, 2.5],
    [5, 2.6],
  ])('qualidade %i ajusta facilidade para %f', (quality, expected) => {
    expect(reviewCard(initialReview(now), quality!, now).easiness).toBe(
      expected,
    )
  })
  it('mantém limites de facilidade e intervalo sem overflow', () => {
    expect(
      reviewCard({ ...initialReview(now), easiness: 1.3 }, 0, now).easiness,
    ).toBe(1.3)
    expect(
      reviewCard(
        {
          ...initialReview(now),
          easiness: 10,
          repetitions: 999999,
          interval: 36500,
        },
        5,
        now,
      ),
    ).toMatchObject({ easiness: 10, repetitions: 1000000, interval: 36500 })
  })
  it('um estado importado com intervalo zero sempre agenda outro dia', () => {
    expect(
      reviewCard(
        { ...initialReview(now), repetitions: 3, interval: 0 },
        5,
        now,
      ),
    ).toMatchObject({ interval: 1, nextReview: '2026-10-04' })
  })
  it.each([-1, 6, 1.5, NaN, Infinity])(
    'rejeita qualidade inválida %s',
    (quality) => {
      expect(() => reviewCard(initialReview(now), quality, now)).toThrow()
    },
  )
  it('datas locais atravessam ano e ano bissexto, sem mutar o estado', () => {
    const original = initialReview(now)
    const copy = structuredClone(original)
    expect(
      reviewCard(original, 4, new Date(2024, 1, 28, 23, 59)).nextReview,
    ).toBe('2024-02-29')
    expect(
      reviewCard(original, 4, new Date(2026, 11, 31, 23, 59)).nextReview,
    ).toBe('2027-01-01')
    expect(original).toEqual(copy)
    expect(() => reviewCard(original, 4, new Date(NaN))).toThrow()
  })
  it('fila inclui atrasados e hoje, exclui suspensos e futuros e ordena deterministicamente', () => {
    const make = (
      id: string,
      nextReview: string,
      status: 'active' | 'suspended' = 'active',
    ) =>
      flashcardSchema.parse({
        id,
        question: id,
        answer: 'Resposta',
        status,
        tags: [],
        links: [],
        isExample: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        review: { ...initialReview(now), nextReview },
      })
    const cards = [
      make('b', '2026-10-03'),
      make('c', '2026-10-04'),
      make('a', '2026-10-01'),
      make('d', '2026-10-02', 'suspended'),
    ]
    expect(dueCards(cards, now).map((card) => card.id)).toEqual(['a', 'b'])
    expect(cards[0]!.id).toBe('b')
  })
  it('modelo recusa revisão inválida e pergunta vazia', () => {
    expect(
      reviewSchema.safeParse({ ...initialReview(now), interval: -1 }).success,
    ).toBe(false)
    expect(
      reviewSchema.safeParse({ ...initialReview(now), easiness: 1 }).success,
    ).toBe(false)
    expect(flashcardSchema.safeParse({ question: ' ' }).success).toBe(false)
  })
})
