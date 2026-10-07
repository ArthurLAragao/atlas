import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test.describe('Carga tardia controlada', () => {
  // Block SW only here: cache hits must not bypass the intentional network gate.
  test.use({ serviceWorkers: 'block' })
  test('parser sob demanda não bloqueia Hoje e sheet mantém foco durante carga', async ({
    page,
  }) => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let requests = 0
    await page.route('**/assets/note-links-*.js', async (route) => {
      requests++
      await gate
      await route.continue()
    })
    try {
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Hoje', exact: true }),
      ).toBeVisible()
      expect(requests).toBe(0)
      await page
        .getByRole('button', { name: 'Seus dados', exact: true })
        .click()
      await expect(
        page.getByRole('dialog', { name: 'Seus dados' }),
      ).toBeVisible()
      await expect.poll(() => requests).toBe(1)
      await expect(page.getByText('Preparando ações de dados.')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('button', { name: 'Seus dados', exact: true }),
      ).toBeFocused()
      release()
      await page
        .getByRole('button', { name: 'Seus dados', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'Exportar JSON', exact: true }),
      ).toBeVisible()
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(axe.violations).toEqual([])
      await page.keyboard.press('Escape')
    } finally {
      release()
    }
  })
})

test('sheet de dados ainda não visitada abre offline após preparação online', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Exportar Markdown', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Seus dados', exact: true }),
  ).toBeFocused()
})
