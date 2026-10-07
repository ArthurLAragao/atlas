import { expect, it } from 'vitest'
import { buildSeed } from '../data/seed'
import { filterTasks, taskCounts } from './task-filter'
it('contagens usam os dados filtrados por contexto e busca', () => {
  const tasks = buildSeed(new Date('2026-10-03T12:00:00Z')).tasks
  const sample = tasks[0]!
  const filtered = filterTasks(
    tasks,
    sample.title,
    sample.context ? `context:${sample.context}` : 'none',
    'all',
  )
  expect(filtered.map((t) => t.id)).toContain(sample.id)
  const counts = taskCounts(filtered)
  expect(counts.all).toBe(filtered.length)
  expect(counts.todo + counts.doing + counts.done).toBe(counts.all)
  expect(
    filterTasks(tasks, sample.title, 'all', 'done').every(
      (t) => t.status === 'done',
    ),
  ).toBe(true)
  expect(filterTasks(tasks, 'não existe', 'all', 'all')).toEqual([])
})
