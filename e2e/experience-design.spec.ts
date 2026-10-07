import { evidencePath } from './evidence.js'
import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test('nomes acessíveis de Hoje incluem o rótulo visível para comandos de voz', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true, level: 1 }),
  ).toBeVisible()
  expect(
    (
      await new AxeBuilder({ page })
        .withRules(['label-content-name-mismatch'])
        .analyze()
    ).violations,
  ).toEqual([])
})

test('conforto segue o sistema, permite escolha explícita e mantém alvos de toque', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-reduced-transparency', value: 'reduce' },
    ],
  })
  await page.goto('/preferencias')
  await expect(
    page.getByRole('heading', { name: 'Preferências', exact: true, level: 1 }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-solid', 'true')
  expect(
    await page
      .locator('.toolbar')
      .evaluate((node) => getComputedStyle(node).backdropFilter),
  ).toBe('none')
  await page.getByLabel('Movimento', { exact: true }).selectOption('allow')
  await page.getByLabel('Transparência', { exact: true }).selectOption('allow')
  await expect(page.locator('html')).toHaveAttribute('data-solid', 'false')
  expect(
    await page
      .locator('.toolbar')
      .evaluate((node) => getComputedStyle(node).backdropFilter),
  ).toContain('blur')
  await page.getByLabel('Movimento', { exact: true }).selectOption('reduce')
  await page.getByLabel('Transparência', { exact: true }).selectOption('reduce')
  await page.setViewportSize({ width: 375, height: 900 })
  for (const node of await page
    .locator(
      '.widget-options button, .widget-toggle, .preferences-fields select',
    )
    .all()) {
    const box = await node.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: 'Limpar todos os dados' }).click()
  await expect(
    page.getByRole('button', { name: 'Manter meus dados' }),
  ).toBeFocused()
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Limpar todos os dados' }),
  ).toBeFocused()
})

test('revisão visual de Hoje e Preferências nas três larguras e dois temas', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const theme of ['light', 'dark']) {
    await page.goto('/preferencias')
    await page.getByLabel('Tema', { exact: true }).selectOption(theme)
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-8-preferencias-${width}-${theme}.png`,
        ),
        fullPage: true,
      })
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Hoje', exact: true, level: 1 }),
      ).toBeVisible()
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-8-hoje-${width}-${theme}.png`,
        ),
        fullPage: true,
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page.goto('/preferencias')
      await expect(
        page.getByRole('heading', {
          name: 'Preferências',
          exact: true,
          level: 1,
        }),
      ).toBeVisible()
    }
  }
  expect(errors).toEqual([])
})
