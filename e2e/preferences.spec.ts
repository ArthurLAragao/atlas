import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { AxeBuilder } from '@axe-core/playwright'

test('preferências, widgets por teclado, ocultar e restaurar persistem', async ({
  page,
}) => {
  await page.goto('/preferencias')
  await expect(
    page.getByRole('heading', { name: 'Preferências', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Tema', { exact: true }).selectOption('light')
  await page.getByLabel('Movimento', { exact: true }).selectOption('reduce')
  await page.getByLabel('Transparência', { exact: true }).selectOption('reduce')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-solid', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
  const down = page.getByRole('button', {
    name: 'Mover Prioridades para baixo',
  })
  await down.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-widget-title="priorities"]')).toBeFocused()
  await page
    .getByRole('checkbox', { name: 'Hábitos de hoje', exact: true })
    .uncheck()
  await page.goto('/')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
  expect(
    await page
      .locator('[data-today-widget]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-today-widget')),
      ),
  ).toEqual(['review', 'priorities', 'appointment', 'goal'])
  await expect(
    page.getByRole('heading', { name: 'Hábitos de hoje' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Organizar Hoje' }).click()
  await page
    .getByRole('button', { name: 'Restaurar organização padrão' })
    .click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Organizar Hoje' }),
  ).toBeFocused()
  await expect(
    page.getByRole('heading', { name: 'Hábitos de hoje' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
  expect(
    await page
      .locator('[data-today-widget]')
      .first()
      .getAttribute('data-today-widget'),
  ).toBe('priorities')
})

test('preferências exportam, limpam com confirmação forte e restauram dados', async ({
  page,
}) => {
  await page.goto('/preferencias')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  const backup = await readFile((await (await download).path())!, 'utf8')
  await page.getByRole('button', { name: 'Limpar todos os dados' }).click()
  await expect(
    page.getByRole('button', { name: 'Apagar definitivamente' }),
  ).toBeDisabled()
  await page.getByLabel('Digite APAGAR TUDO').fill('APAGAR TUDO')
  await page.getByRole('checkbox', { name: /Entendo que a limpeza/ }).check()
  await page.getByRole('button', { name: 'Apagar definitivamente' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Remover exemplos (0)' }),
  ).toBeDisabled()
  await page.getByLabel('Arquivo para importar').setInputFiles({
    name: 'atlas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  })
  await page.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(
    page.getByText(
      '20 registros importados. 0 registros existentes preservados.',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Limpar todos os dados' }).click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Limpar todos os dados' }),
  ).toBeFocused()
})

test('preferências acessíveis, 200% de texto e 375/768/1280 nos dois temas', async ({
  page,
}) => {
  await page.goto('/preferencias')
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Tema', { exact: true }).selectOption(theme)
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([])
    }
  }
})

test('XP é discreto, ocultável e não duplica ao reabrir a tarefa', async ({
  page,
}) => {
  await page.goto('/tarefas')
  await expect(
    page.getByRole('heading', { name: 'Tarefas', exact: true, level: 1 }),
  ).toBeVisible()
  const task = page.locator('[data-task-id="example-task-0"] .task-check')
  await task.click()
  await task.click()
  await task.click()
  await page.goto('/preferencias')
  await expect(page.locator('[data-experience-summary]')).toContainText('10 XP')
  await page.getByRole('checkbox', { name: 'Mostrar resumo de XP' }).uncheck()
  await page.reload()
  await expect(
    page.getByRole('checkbox', { name: 'Mostrar resumo de XP' }),
  ).not.toBeChecked()
  await expect(page.locator('[data-experience-summary]')).toHaveCount(0)
})

test('arraste e widgets opcionais preservam a ordem de leitura e o estado vazio orienta', async ({
  page,
}) => {
  await page.goto('/preferencias')
  const handle = page.getByRole('button', {
    name: 'Arrastar Foco',
    exact: true,
  })
  await handle.scrollIntoViewIfNeeded()
  const origin = (await handle.boundingBox())!
  await page.mouse.move(
    origin.x + origin.width / 2,
    origin.y + origin.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    origin.x + origin.width / 2,
    origin.y + origin.height / 2 - 16,
    { steps: 4 },
  )
  const destination = page.locator('[data-widget-row="priorities"]')
  await destination.scrollIntoViewIfNeeded()
  const target = (await destination.boundingBox())!
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 4 },
  )
  await page.mouse.up()
  await expect(page.locator('[data-widget-row]').first()).toHaveAttribute(
    'data-widget-row',
    'focus',
  )
  await page.getByRole('checkbox', { name: 'Foco', exact: true }).check()
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true, level: 1 }),
  ).toBeVisible()
  await expect(page.locator('[data-today-widget]').first()).toHaveAttribute(
    'data-today-widget',
    'focus',
  )
  await expect(
    page.getByRole('heading', { name: 'Foco', exact: true, level: 2 }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Organizar Hoje' }).click()
  const checkboxes = page.getByRole('dialog').getByRole('checkbox')
  for (let index = 0; index < (await checkboxes.count()); index++)
    await checkboxes.nth(index).uncheck()
  await page.keyboard.press('Escape')
  await expect(
    page.getByText(
      'Hoje está livre. Use Organizar Hoje para adicionar seu primeiro widget.',
    ),
  ).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-today-widget]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Organizar Hoje' }),
  ).toBeVisible()
})
