import { expect, it } from 'vitest'
import { buildSeed } from './seed'
import { goalSchema, projectSchema } from './models'
import { decodeBackup, encodeBackup } from '../lib/transfer'

it.each([
  'github.com/atlas',
  'https://',
  'javascript:alert(1)',
  'file:///atlas',
  '',
])(
  'URL inválida %s é um resultado de validação, sem lançar',
  (repositoryUrl) => {
    expect(() =>
      projectSchema.safeParse({ ...buildSeed().projects[0]!, repositoryUrl }),
    ).not.toThrow()
    expect(
      projectSchema.safeParse({ ...buildSeed().projects[0]!, repositoryUrl })
        .success,
    ).toBe(false)
  },
)
it('URL de link inválida também retorna erro', () => {
  expect(
    projectSchema.safeParse({
      ...buildSeed().projects[0]!,
      urls: [{ title: 'Link', url: 'https://' }],
    }).success,
  ).toBe(false)
})
it('prazo com ano zero não entra pelo modelo nem pela importação', () => {
  const data = buildSeed()
  const goal = { ...data.goals[0]!, deadline: '0000-01-01' }
  expect(goalSchema.safeParse(goal).success).toBe(false)
  const invalid = JSON.parse(encodeBackup(data)) as {
    data: { goals: unknown[] }
  }
  invalid.data.goals = [goal]
  expect(() => decodeBackup(JSON.stringify(invalid))).toThrow()
})
it('backup preserva todos os novos campos e as medidas manuais', () => {
  const data = buildSeed()
  data.goals[0] = {
    ...data.goals[0]!,
    description: 'Propósito',
    status: 'completed',
    weekly: true,
    keyResults: [
      { id: 'hours', title: 'Estudo', current: 8, target: 30, unit: 'horas' },
    ],
  }
  data.projects[0] = {
    ...data.projects[0]!,
    status: 'paused',
    repositoryUrl: 'https://example.org/atlas',
  }
  expect(decodeBackup(encodeBackup(data))).toEqual(data)
})
