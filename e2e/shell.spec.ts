import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test('rotas, temas, teclado, persistência e acessibilidade', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hoje')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  for (const [path, title] of [
    ['tarefas', 'Tarefas'],
    ['habitos', 'Hábitos'],
    ['notas', 'Notas'],
    ['metas', 'Metas e projetos'],
    ['estudos', 'Estudos'],
  ]) {
    await page.goto(`/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      title ?? '',
    )
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([])
  }
  await page.goto('/')
  // The requested dock replaces the collapsible sidebar; routes keep names and keyboard access.
  await expect(page.locator('aside.sidebar')).toHaveCount(0)
  const dock = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(dock.getByRole('link', { name: 'Meu perfil' })).toBeVisible()
  await expect(dock.getByRole('link', { name: 'Hábitos' })).toBeVisible()
  await dock.getByRole('link', { name: 'Meu perfil' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/perfil/u)
  await page.goto('/')
  await page.getByRole('button', { name: 'Aparência' }).focus()
  await page.keyboard.press('Enter')
  for (const theme of ['Claro', 'Escuro']) {
    await page.getByRole('radio', { name: theme, exact: true }).check()
    for (const accent of ['Azul', 'Grafite', 'Verde']) {
      await page.getByRole('radio', { name: accent, exact: true }).check()
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([])
    }
  }
  await page.getByRole('radio', { name: 'Claro', exact: true }).check()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Aparência' })).toBeFocused()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Aparência' }).click()
  await page.getByRole('radio', { name: 'Sistema', exact: true }).check()
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('checkbox', { name: 'Reduzir transparência' }).check()
  await expect(page.locator('.toolbar')).toHaveCSS('backdrop-filter', 'none')
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('layout em 375, 768 e 1280 px, zoom de texto e navegação móvel', async ({
  page,
}) => {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([])
    await page.screenshot({
      path: `test-results/regression-shell-${width}.png`,
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Mais páginas', exact: true }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('link', { name: 'Estudos', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Estudos' }),
  ).toBeFocused()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Aparência' }).click()
  await expect(
    page.getByRole('radio', { name: 'Claro', exact: true }),
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Claro', exact: true }).check()
  await page.keyboard.press('Escape')
  await page.screenshot({
    path: 'test-results/regression-shell-texto-200.png',
    fullPage: true,
  })
})
