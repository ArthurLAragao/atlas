import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test('Hoje usa perfil fictício persistido, mantém fallback neutro e leitura móvel', async ({
  page,
}) => {
  await page.goto('/')
  const neutral =
    'Um dia de cada vez. Escolha poucos passos e deixe espaço para respirar.'
  await expect(page.getByText(neutral, { exact: true })).toBeVisible()
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Nome de exibição').fill('Pessoa Exemplo')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Pessoa Exemplo',
      exact: true,
    }),
  ).toBeVisible()
  await page.goto('/')
  await expect(
    page.getByText(/^Um dia de cada vez, Pessoa Exemplo\./),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText(/^Um dia de cada vez, Pessoa Exemplo\./),
  ).toBeVisible()
  await page.setViewportSize({ width: 375, height: 900 })
  await expect(
    page.getByText(/^Um dia de cada vez, Pessoa Exemplo\./),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Nome de exibição').fill('')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/')
  await page.reload()
  await expect(page.getByText(neutral, { exact: true })).toBeVisible()
})
