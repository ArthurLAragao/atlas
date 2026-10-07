import { describe, expect, it } from 'vitest'
import type { StudyPath, Subject } from '../data/models'
import {
  assessmentAverage,
  attendance,
  eventCountdown,
  nextStudyEvent,
  pathProgress,
  pathStatusLabels,
  subjectStatusLabels,
} from './study'

function assessment(
  score: number,
  maxScore = 10,
  weight: number | null = null,
  id = 'assessment',
): Subject['assessments'][number] {
  return { id, title: id, score, maxScore, weight, date: null, notes: '' }
}

function event(
  id: string,
  date: string,
  status: Subject['events'][number]['status'] = 'pending',
): Subject['events'][number] {
  return {
    id,
    title: id,
    date,
    status,
    kind: 'exam',
    description: '',
    taskId: null,
  }
}

function subject(
  id: string,
  events: Subject['events'],
  status: Subject['status'] = 'active',
): Pick<Subject, 'id' | 'events' | 'status'> {
  return { id, events, status }
}

function step(id: string, done = false): StudyPath['steps'][number] {
  return {
    id,
    title: id,
    done,
    url: null,
    estimatedMinutes: null,
    noteId: null,
    taskId: null,
  }
}

describe('médias acadêmicas normalizadas', () => {
  it('mantém média vazia distinta de nota zero', () => {
    expect(assessmentAverage([])).toEqual({
      value: null,
      method: 'simple',
      label: 'Média simples · escala de 0 a 10',
    })
    expect(assessmentAverage([assessment(0)]).value).toBe(0)
  })

  it('normaliza máximos diferentes antes da média simples e não modifica os registros', () => {
    const items = [assessment(8), assessment(40, 100, null, 'other')]
    const before = structuredClone(items)
    expect(assessmentAverage(items)).toEqual({
      value: 6,
      method: 'simple',
      label: 'Média simples · escala de 0 a 10',
    })
    expect(items).toEqual(before)
  })

  it('usa pesos relativos e explica o cálculo escolhido', () => {
    const average = assessmentAverage([
      assessment(8, 10, 2),
      assessment(40, 100, 1, 'other'),
    ])
    expect(average).toEqual({
      value: 6.67,
      method: 'weighted',
      label: 'Média ponderada · escala de 0 a 10',
    })
  })

  it('atribui peso um às avaliações sem peso somente quando há algum peso explícito', () => {
    const average = assessmentAverage([
      assessment(10, 10, 3),
      assessment(0, 10, null, 'other'),
    ])
    expect(average).toEqual({
      value: 7.5,
      method: 'weighted',
      label: 'Média ponderada · escala de 0 a 10 · peso não informado = 1',
    })
  })

  it('aceita pesos fracionários e não arredonda cada avaliação antes de calcular', () => {
    expect(
      assessmentAverage([assessment(1, 3, 0.5), assessment(2, 3, 0.5, 'other')])
        .value,
    ).toBe(5)
    expect(assessmentAverage([assessment(1, 3)]).value).toBe(3.33)
  })

  it('permanece finita com notas e pesos muito grandes ou muito pequenos', () => {
    expect(
      assessmentAverage([
        assessment(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
        assessment(0, Number.MIN_VALUE, Number.MAX_VALUE, 'other'),
      ]).value,
    ).toBe(5)
    expect(
      assessmentAverage([
        assessment(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE),
      ]).value,
    ).toBe(10)
  })

  it.each([
    [-1, 10, null],
    [11, 10, null],
    [NaN, 10, null],
    [Infinity, 10, null],
    [0, 0, null],
    [0, -1, null],
    [0, NaN, null],
    [0, Infinity, null],
    [1, 10, 0],
    [1, 10, -1],
    [1, 10, Infinity],
    [1, 10, NaN],
  ])(
    'recusa avaliação inválida %s de %s com peso %s',
    (score, maxScore, weight) => {
      expect(() =>
        assessmentAverage([assessment(score, maxScore, weight)]),
      ).toThrow(RangeError)
    },
  )
})

describe('faltas e presença estimada', () => {
  it('não inventa presença ou limite quando os dados não foram informados', () => {
    expect(
      attendance({ absences: 3, absenceLimit: null, classesHeld: null }),
    ).toEqual({
      percentage: null,
      remaining: null,
      overLimit: false,
      label: 'Informe as aulas realizadas para estimar a presença.',
    })
    expect(
      attendance({ absences: 0, absenceLimit: null, classesHeld: 0 })
        .percentage,
    ).toBeNull()
  })

  it.each([
    [0, 8, 100],
    [2, 8, 75],
    [1, 3, 67],
    [3, 3, 0],
  ])(
    'estima presença para %s faltas em %s aulas como %s%%',
    (absences, classesHeld, percentage) => {
      expect(attendance({ absences, absenceLimit: null, classesHeld })).toEqual(
        {
          percentage,
          remaining: null,
          overLimit: false,
          label: `Presença estimada: ${percentage}% das aulas realizadas.`,
        },
      )
    },
  )

  it.each([
    [2, 4, 2, false],
    [4, 4, 0, false],
    [5, 4, 0, true],
    [0, 0, 0, false],
    [1, 0, 0, true],
  ])(
    'distingue limite atingido e ultrapassado para %s faltas com limite %s',
    (absences, absenceLimit, remaining, overLimit) => {
      expect(
        attendance({ absences, absenceLimit, classesHeld: null }),
      ).toMatchObject({ remaining, overLimit })
    },
  )

  it('não modifica os valores cadastrados', () => {
    const item = { absences: 2, absenceLimit: 8, classesHeld: 10 }
    const before = structuredClone(item)
    attendance(item)
    expect(item).toEqual(before)
  })

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'recusa contagens inválidas %s em cada campo',
    (invalid) => {
      expect(() =>
        attendance({
          absences: invalid,
          absenceLimit: null,
          classesHeld: null,
        }),
      ).toThrow(RangeError)
      expect(() =>
        attendance({ absences: 0, absenceLimit: invalid, classesHeld: null }),
      ).toThrow(RangeError)
      expect(() =>
        attendance({ absences: 0, absenceLimit: null, classesHeld: invalid }),
      ).toThrow(RangeError)
    },
  )

  it('pede revisão quando novas faltas superam a última contagem de aulas informada, sem bloquear o registro', () => {
    expect(
      attendance({ absences: 3, absenceLimit: 2, classesHeld: 2 }),
    ).toEqual({
      percentage: null,
      remaining: 0,
      overLimit: true,
      label: 'Revise as aulas realizadas: há mais faltas que aulas informadas.',
    })
    expect(
      attendance({ absences: 1, absenceLimit: null, classesHeld: 0 }),
    ).toMatchObject({
      percentage: null,
      label: 'Revise as aulas realizadas: há mais faltas que aulas informadas.',
    })
  })
})

describe('datas de provas e entregas', () => {
  it.each([
    ['2026-10-02', 0, 'today', 'Hoje'],
    ['2026-10-03', 1, 'future', 'Falta 1 dia'],
    ['2026-10-05', 3, 'future', 'Faltam 3 dias'],
    ['2026-10-01', -1, 'overdue', 'Vencida há 1 dia'],
    ['2026-09-29', -3, 'overdue', 'Vencida há 3 dias'],
  ] as const)(
    'explica a data %s por texto e estado',
    (date, days, state, label) => {
      expect(eventCountdown(event('test', date), '2026-10-02')).toEqual({
        days,
        state,
        label,
      })
    },
  )

  it('prioriza conclusão explícita mesmo depois do prazo', () => {
    expect(
      eventCountdown(event('test', '2026-10-01', 'completed'), '2026-10-02'),
    ).toEqual({ days: -1, state: 'completed', label: 'Concluída' })
  })

  it.each([
    ['2027-01-01', '2026-12-31', 1],
    ['2024-03-01', '2024-02-28', 2],
    ['2026-03-01', '2026-02-28', 1],
    ['2026-03-09', '2026-03-07', 2],
    ['2026-11-02', '2026-10-31', 2],
    ['0001-01-02', '0001-01-01', 1],
    ['9999-12-31', '9999-12-30', 1],
  ])(
    'usa dias de calendário de %s a %s, inclusive ano bissexto e transição de horário',
    (date, now, days) => {
      expect(eventCountdown(event('test', date), now).days).toBe(days)
    },
  )

  it('aceita referência Date e compara seu dia local independentemente da hora', () => {
    expect(
      eventCountdown(
        event('test', '2026-10-03'),
        new Date(2026, 9, 2, 23, 59, 59),
      ),
    ).toMatchObject({ days: 1, state: 'future' })
    expect(
      eventCountdown(
        event('test', '2026-10-02'),
        new Date(2026, 9, 2, 0, 0, 1),
      ),
    ).toMatchObject({ days: 0, state: 'today' })
  })

  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-1-01',
    '0000-01-01',
    '10000-01-01',
    '',
    '2026-10-02T12:00:00Z',
  ])('recusa data inválida %s nos eventos e na referência', (invalid) => {
    expect(() => eventCountdown(event('test', invalid), '2026-10-02')).toThrow(
      RangeError,
    )
    expect(() => eventCountdown(event('test', '2026-10-02'), invalid)).toThrow(
      RangeError,
    )
  })

  it('recusa Date inválida e não ignora uma data inválida em evento concluído', () => {
    expect(() =>
      eventCountdown(event('test', '2026-10-02'), new Date(NaN)),
    ).toThrow(RangeError)
    expect(() =>
      eventCountdown(event('test', '2026-02-30', 'completed'), '2026-10-02'),
    ).toThrow(RangeError)
    expect(() => nextStudyEvent([], new Date(NaN))).toThrow(RangeError)
  })

  it('seleciona apenas eventos pendentes de disciplinas ativas, incluindo hoje', () => {
    const selected = subject('active', [
      event('late', '2026-10-01'),
      event('tomorrow', '2026-10-03'),
      event('today', '2026-10-02'),
    ])
    const subjects = [
      subject('archived', [event('today', '2026-10-02')], 'archived'),
      subject('completed', [event('today', '2026-10-02')], 'completed'),
      subject('done-event', [event('today', '2026-10-02', 'completed')]),
      selected,
    ]
    const before = structuredClone(subjects)
    expect(nextStudyEvent(subjects, '2026-10-02')).toEqual({
      subject: selected,
      event: selected.events[2],
    })
    expect(subjects).toEqual(before)
  })

  it('resolve empates por IDs sem depender da ordem da lista', () => {
    const subjects = [
      subject('z', [event('a', '2026-10-03')]),
      subject('a', [event('z', '2026-10-03'), event('a', '2026-10-03')]),
    ]
    expect(nextStudyEvent(subjects, '2026-10-02')?.subject.id).toBe('a')
    expect(nextStudyEvent(subjects, '2026-10-02')?.event.id).toBe('a')
    expect(nextStudyEvent([...subjects].reverse(), '2026-10-02')).toEqual(
      nextStudyEvent(subjects, '2026-10-02'),
    )
  })

  it('retorna vazio útil quando não há evento futuro elegível', () => {
    expect(nextStudyEvent([], '2026-10-02')).toBeNull()
    expect(
      nextStudyEvent(
        [subject('active', [event('late', '2026-10-01')])],
        '2026-10-02',
      ),
    ).toBeNull()
  })
})

describe('progresso e próximo passo de trilhas', () => {
  it('trata trilha vazia como sem progresso nem próximo passo', () => {
    expect(pathProgress({ steps: [] })).toEqual({
      done: 0,
      total: 0,
      percent: 0,
      next: null,
    })
  })

  it('calcula por itens concluídos e escolhe primeiro incompleto sem alterar ordem ou vínculos', () => {
    const path = {
      steps: [
        step('one', true),
        { ...step('two'), estimatedMinutes: 45, noteId: 'note' },
        step('three'),
      ],
    }
    const before = structuredClone(path)
    expect(pathProgress(path)).toEqual({
      done: 1,
      total: 3,
      percent: 33,
      next: path.steps[1],
    })
    expect(path).toEqual(before)
  })

  it('não usa estimativas de tempo como peso e não trata tarefa vinculada como etapa concluída', () => {
    const path = {
      steps: [
        { ...step('one', true), estimatedMinutes: 1 },
        { ...step('two'), estimatedMinutes: 999, taskId: 'completed-task' },
      ],
    }
    expect(pathProgress(path)).toEqual({
      done: 1,
      total: 2,
      percent: 50,
      next: path.steps[1],
    })
  })

  it('retorna cem por cento e próximo passo nulo quando todos os itens estão concluídos', () => {
    expect(
      pathProgress({ steps: [step('one', true), step('two', true)] }),
    ).toEqual({ done: 2, total: 2, percent: 100, next: null })
  })

  it('fornece rótulos acessíveis em português para todos os estados', () => {
    expect(subjectStatusLabels).toEqual({
      active: 'Ativa',
      completed: 'Concluída',
      archived: 'Arquivada',
    })
    expect(pathStatusLabels).toEqual({
      active: 'Em andamento',
      completed: 'Concluída',
      archived: 'Arquivada',
    })
  })
})
