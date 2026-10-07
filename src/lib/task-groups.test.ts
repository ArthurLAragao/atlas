import { expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { groupTasksByDate } from './task-groups'

it('agrupa datas sem duplicar tarefas, preservando a ordem em cada grupo', () => {
  const base = buildSeed().tasks[0]!
  const tasks = [
    { ...base, id: 'past', dueDate: '2026-10-03', status: 'todo' as const },
    { ...base, id: 'today', dueDate: '2026-10-04', status: 'doing' as const },
    { ...base, id: 'future', dueDate: '2026-10-05', status: 'todo' as const },
    { ...base, id: 'none', dueDate: null, status: 'todo' as const },
    { ...base, id: 'done', dueDate: '2026-10-03', status: 'done' as const },
  ]
  const groups = groupTasksByDate(tasks, '2026-10-04')
  expect(groups.map((group) => group.title)).toEqual([
    'Atrasadas',
    'Hoje',
    'Próximas',
    'Sem prazo',
    'Concluídas',
  ])
  expect(groups.flatMap((group) => group.tasks)).toEqual(tasks)
  expect(tasks[0]!.dueDate).toBe('2026-10-03')
})

it('omite grupos vazios e não muda o prazo de tarefas concluídas', () => {
  expect(groupTasksByDate([], '2026-10-04')).toEqual([])
  const task = {
    ...buildSeed().tasks[0]!,
    status: 'done' as const,
    dueDate: null,
  }
  expect(groupTasksByDate([task], '2026-10-04')).toEqual([
    { title: 'Concluídas', tasks: [task] },
  ])
})
