import { describe, expect, it } from 'vitest'
import {
  emptySnapshot,
  type Goal,
  type Note,
  type Project,
  type Task,
} from '../data/models'
import {
  daysRemaining,
  directionHref,
  goalDeadline,
  goalProgress,
  goalStatus,
  goalStatusLabels,
  keyResultProgress,
  projectStatus,
  projectStatusLabels,
  relatedRecords,
  selectedWeeklyGoal,
} from './goals'

const timestamp = '2026-10-02T12:00:00Z'
const base = (id: string) => ({
  id,
  title: id,
  tags: [],
  links: [],
  isExample: false,
  createdAt: timestamp,
  updatedAt: timestamp,
})
function goal(id: string, changes: Partial<Goal> = {}): Goal {
  return { ...base(id), deadline: null, keyResults: [], ...changes }
}
function project(id: string, changes: Partial<Project> = {}): Project {
  return {
    ...base(id),
    description: '',
    repositoryUrl: null,
    urls: [],
    ...changes,
  }
}
function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    ...base(id),
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    dueTime: null,
    context: null,
    subtasks: [],
    repeat: null,
    focusMinutes: 0,
    ...changes,
  }
}
function note(id: string, changes: Partial<Note> = {}): Note {
  return { ...base(id), content: '', ...changes }
}
function result(
  current: number,
  target: number,
  id = 'result',
): Goal['keyResults'][number] {
  return { id, title: id, current, target }
}

describe('progresso manual de resultados-chave', () => {
  it.each([
    [0, 10, 0],
    [-0, 10, 0],
    [3, 10, 30],
    [8, 30, 27],
    [1, 3, 33],
    [2, 3, 67],
    [9.95, 10, 100],
    [10, 10, 100],
    [15, 10, 100],
    [0.25, 1, 25],
    [Number.MAX_VALUE, Number.MIN_VALUE, 100],
    [Number.MIN_VALUE, Number.MIN_VALUE, 100],
    [Number.MAX_VALUE / 2, Number.MAX_VALUE, 50],
  ])(
    'mostra %s / %s como %s por cento sem alterar os valores',
    (current, target, expected) => {
      const item = result(current, target)
      const before = structuredClone(item)
      expect(keyResultProgress(item)).toBe(expected)
      expect(item).toEqual(before)
    },
  )

  it.each([
    [0, 0],
    [0, -1],
    [-1, 10],
    [NaN, 10],
    [Infinity, 10],
    [-Infinity, 10],
    [1, NaN],
    [1, Infinity],
    [1, -Infinity],
  ])(
    'recusa valores inválidos %s / %s em vez de ocultá-los',
    (current, target) => {
      expect(() => keyResultProgress(result(current, target))).toThrow(
        RangeError,
      )
      expect(() =>
        goalProgress(goal('bad', { keyResults: [result(current, target)] })),
      ).toThrow(RangeError)
    },
  )

  it('calcula média das razões antes de arredondar, sem somar unidades diferentes', () => {
    const selected = goal('aws', {
      keyResults: [
        { ...result(3, 10, 'modules'), unit: 'módulos' },
        { ...result(8, 30, 'hours'), unit: 'horas' },
      ],
      links: [{ type: 'tasks', id: 'done' }],
    })
    const before = structuredClone(selected)
    expect(goalProgress(selected)).toEqual({
      percent: 28,
      completed: 0,
      total: 2,
    })
    expect(selected).toEqual(before)
  })

  it('limita cada resultado antes da média, preservando valores além do alvo', () => {
    const selected = goal('goal', {
      keyResults: [result(300, 10, 'extra'), result(0, 10, 'zero')],
    })
    expect(goalProgress(selected)).toEqual({
      percent: 50,
      completed: 1,
      total: 2,
    })
    expect(selected.keyResults[0]?.current).toBe(300)
  })

  it('distingue porcentagem arredondada de resultado efetivamente alcançado', () => {
    expect(
      goalProgress(goal('almost', { keyResults: [result(9.95, 10)] })),
    ).toEqual({
      percent: 100,
      completed: 0,
      total: 1,
    })
  })

  it('mantém progresso manual independente de estado, tarefas e escolha semanal', () => {
    const selected = goal('manual', {
      status: 'completed',
      weekly: true,
      keyResults: [result(1, 4)],
      links: [
        { type: 'tasks', id: 'task' },
        { type: 'projects', id: 'project' },
      ],
    })
    expect(goalProgress(selected)).toEqual({
      percent: 25,
      completed: 0,
      total: 1,
    })
    expect(
      goalProgress({
        ...selected,
        status: 'archived',
        weekly: false,
        links: [],
      }),
    ).toEqual(goalProgress(selected))
    expect(goalProgress(goal('empty'))).toEqual({
      percent: 0,
      completed: 0,
      total: 0,
    })
  })

  it('não transborda ao calcular média de vários resultados extremos finitos', () => {
    expect(
      goalProgress(
        goal('extreme', {
          keyResults: [
            result(Number.MAX_VALUE, Number.MIN_VALUE, 'a'),
            result(Number.MAX_VALUE, 1, 'b'),
          ],
        }),
      ),
    ).toEqual({ percent: 100, completed: 2, total: 2 })
  })
})

describe('estados compatíveis com dados anteriores', () => {
  it('usa defaults somente quando o registro antigo não tem estado', () => {
    expect(goalStatus(goal('legacy'))).toBe('active')
    expect(projectStatus(project('legacy'))).toBe('planned')
    expect(goalStatus(goal('done', { status: 'completed' }))).toBe('completed')
    expect(
      goalStatus(
        goal('archive', { status: 'archived', archivedFrom: 'completed' }),
      ),
    ).toBe('archived')
    for (const status of [
      'planned',
      'active',
      'paused',
      'completed',
      'archived',
    ] as const) {
      expect(projectStatus(project(status, { status }))).toBe(status)
    }
  })

  it('rotula cada estado em português sem exigir propriedades novas nos backups antigos', () => {
    expect(goalStatusLabels).toEqual({
      active: 'Ativa',
      completed: 'Concluída',
      archived: 'Arquivada',
    })
    expect(projectStatusLabels).toEqual({
      planned: 'Planejado',
      active: 'Em andamento',
      paused: 'Pausado',
      completed: 'Concluído',
      archived: 'Arquivado',
    })
  })
})

describe('dias de calendário e estados de prazo', () => {
  it.each([
    ['2026-10-02', '2026-10-02', 0],
    ['2026-10-03', '2026-10-02', 1],
    ['2026-10-02', '2026-10-03', -1],
    ['2027-01-01', '2026-12-31', 1],
    ['2024-03-01', '2024-02-28', 2],
    ['2026-03-01', '2026-02-28', 1],
    ['2026-03-09', '2026-03-07', 2],
    ['2026-11-02', '2026-10-31', 2],
    ['0001-01-02', '0001-01-01', 1],
    ['9999-12-31', '9999-12-30', 1],
  ])('conta %s em relação a %s como %s dias', (deadline, today, expected) => {
    expect(daysRemaining(deadline, today)).toBe(expected)
  })

  it.each([
    '2026-02-29',
    '2024-02-30',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '02/10/2026',
    '2026-1-01',
    '2026-01-1',
    '',
    '0000-01-01',
    '10000-01-01',
    '2026-10-02T00:00:00Z',
    ' 2026-10-02',
  ])('rejeita %s tanto como prazo quanto referência', (invalid) => {
    expect(() => daysRemaining(invalid, '2026-10-02')).toThrow(RangeError)
    expect(() => daysRemaining('2026-10-02', invalid)).toThrow(RangeError)
  })

  it.each([
    [null, 'none', null, 'Sem prazo'],
    ['2026-10-02', 'today', 0, 'Prazo hoje'],
    ['2026-10-03', 'upcoming', 1, 'Falta 1 dia'],
    ['2026-10-12', 'upcoming', 10, 'Faltam 10 dias'],
    ['2026-10-01', 'overdue', -1, 'Vencida há 1 dia'],
    ['2026-09-30', 'overdue', -2, 'Vencida há 2 dias'],
  ] as const)('explica o prazo %s como %s', (deadline, state, days, label) => {
    expect(goalDeadline(goal('goal', { deadline }), '2026-10-02')).toEqual({
      state,
      days,
      label,
    })
  })

  it('prioriza estados explícitos e não declara atrasada uma meta concluída ou arquivada', () => {
    expect(
      goalDeadline(
        goal('done', { status: 'completed', deadline: '2026-09-30' }),
        '2026-10-02',
      ),
    ).toEqual({
      state: 'completed',
      days: -2,
      label: 'Meta concluída',
    })
    expect(
      goalDeadline(
        goal('archive', { status: 'archived', deadline: '2026-10-12' }),
        '2026-10-02',
      ),
    ).toEqual({
      state: 'archived',
      days: 10,
      label: 'Meta arquivada',
    })
    expect(
      goalDeadline(goal('done', { status: 'completed' }), '2026-10-02'),
    ).toEqual({
      state: 'completed',
      days: null,
      label: 'Meta concluída',
    })
  })

  it('recusa referência ou prazo inválidos inclusive em metas concluídas e sem prazo', () => {
    expect(() => goalDeadline(goal('none'), 'invalid')).toThrow(RangeError)
    expect(() =>
      goalDeadline(
        goal('done', { status: 'completed', deadline: '2026-02-30' }),
        '2026-10-02',
      ),
    ).toThrow(RangeError)
  })
})

describe('seleção explícita da meta semanal', () => {
  it('não infere a meta a partir de prazo, data recente ou exemplos', () => {
    expect(
      selectedWeeklyGoal([
        goal('recent'),
        goal('deadline', { deadline: '2026-10-04' }),
        goal('example', { isExample: true }),
        goal('false', { weekly: false }),
      ]),
    ).toBeUndefined()
    expect(selectedWeeklyGoal([])).toBeUndefined()
  })

  it('escolhe só uma meta marcada e aceita sua conclusão explícita', () => {
    const selected = goal('chosen', { weekly: true, status: 'completed' })
    expect(selectedWeeklyGoal([goal('other'), selected])).toBe(selected)
    expect(
      selectedWeeklyGoal([
        goal('archive', { weekly: true, status: 'archived' }),
      ]),
    ).toBeUndefined()
  })

  it('resolve escolha ambígua importada pelo ID sem reordenar nem modificar a coleção', () => {
    const items = [
      goal('z', { weekly: true }),
      goal('a', { weekly: true }),
      goal('0', { weekly: true, status: 'archived' }),
    ]
    const before = structuredClone(items)
    expect(selectedWeeklyGoal(items)?.id).toBe('a')
    expect(selectedWeeklyGoal([...items].reverse())?.id).toBe('a')
    expect(items).toEqual(before)
  })
})

describe('relações entre meta, projeto, tarefa e nota por IDs', () => {
  it('combina ambas as direções, deduplica IDs e mantém a ordem dos registros existentes', () => {
    const data = emptySnapshot()
    data.goals = [
      goal('goal', {
        links: [
          { type: 'tasks', id: 'direct' },
          { type: 'tasks', id: 'both' },
          { type: 'tasks', id: 'direct' },
          { type: 'tasks', id: 'missing' },
          { type: 'notes', id: 'wrong-type' },
        ],
      }),
    ]
    data.tasks = [
      task('backlink', { links: [{ type: 'goals', id: 'goal' }] }),
      task('direct'),
      task('both', { links: [{ type: 'goals', id: 'goal' }] }),
      task('both', { title: 'Second duplicate' }),
      task('wrong-type'),
      task('other', { links: [{ type: 'projects', id: 'goal' }] }),
    ]
    const before = structuredClone(data)
    expect(
      relatedRecords(data, 'goals', 'goal', 'tasks').map((item) => item.id),
    ).toEqual(['backlink', 'direct', 'both'])
    expect(relatedRecords(data, 'goals', 'goal', 'tasks')[0]).toBe(
      data.tasks[0],
    )
    expect(data).toEqual(before)
  })

  it('reúne tarefas, notas e metas de um projeto sem considerar texto wiki um vínculo explícito', () => {
    const data = emptySnapshot()
    data.projects = [
      project('atlas', {
        links: [
          { type: 'notes', id: 'note' },
          { type: 'goals', id: 'goal-direct' },
        ],
      }),
    ]
    data.tasks = [
      task('task', { links: [{ type: 'projects', id: 'atlas' }] }),
      task('unrelated'),
    ]
    data.notes = [note('note'), note('wiki', { content: '[[atlas]]' })]
    data.goals = [
      goal('goal-direct'),
      goal('goal-back', { links: [{ type: 'projects', id: 'atlas' }] }),
    ]
    expect(
      relatedRecords(data, 'projects', 'atlas', 'tasks').map((item) => item.id),
    ).toEqual(['task'])
    expect(
      relatedRecords(data, 'projects', 'atlas', 'notes').map((item) => item.id),
    ).toEqual(['note'])
    expect(
      relatedRecords(data, 'projects', 'atlas', 'goals').map((item) => item.id),
    ).toEqual(['goal-direct', 'goal-back'])
    expect(
      relatedRecords(data, 'goals', 'goal-back', 'projects').map(
        (item) => item.id,
      ),
    ).toEqual(['atlas'])
  })

  it('ignora autorreferência, destino ausente, origem ausente e links com o tipo errado', () => {
    const data = emptySnapshot()
    data.goals = [
      goal('self', {
        links: [
          { type: 'goals', id: 'self' },
          { type: 'goals', id: 'missing' },
          { type: 'projects', id: 'other' },
        ],
      }),
      goal('other'),
    ]
    data.notes = [
      note('orphan', { links: [{ type: 'projects', id: 'missing-source' }] }),
    ]
    expect(relatedRecords(data, 'goals', 'self', 'goals')).toEqual([])
    expect(relatedRecords(data, 'projects', 'missing-source', 'notes')).toEqual(
      [],
    )
    expect(
      relatedRecords(emptySnapshot(), 'goals', 'missing', 'tasks'),
    ).toEqual([])
  })

  it('preserva registros arquivados vinculados e não trata título ou tags como IDs', () => {
    const data = emptySnapshot()
    data.projects = [
      project('project', {
        title: 'Título comum',
        tags: ['same'],
        links: [{ type: 'notes', id: 'archived' }],
      }),
    ]
    data.notes = [
      note('archived', { archivedAt: timestamp }),
      note('other', { title: 'Título comum', tags: ['same'] }),
    ]
    expect(
      relatedRecords(data, 'projects', 'project', 'notes').map(
        (item) => item.id,
      ),
    ).toEqual(['archived'])
  })

  it.each([
    ['tasks', '/tarefas?task=id'],
    ['notes', '/notas?note=id'],
    ['goals', '/metas?goal=id'],
    ['projects', '/metas?project=id'],
  ] as const)('navega %s por ID e nunca pelo título', (type, href) => {
    expect(directionHref(type, 'id')).toBe(href)
    expect(directionHref(type, 'id&outro=valor')).toBe(
      href.replace('id', 'id%26outro%3Dvalor'),
    )
  })
})
