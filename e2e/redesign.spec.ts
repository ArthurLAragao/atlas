import { evidencePath } from './evidence.js'
import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'

test('segmentos de metas e projetos preservam coleções, filtros e teclado', async ({
  page,
}) => {
  await page.goto('/metas')
  const goals = page.getByRole('region', {
    name: 'Metas',
    exact: true,
    includeHidden: true,
  })
  const projects = page.getByRole('region', {
    name: 'Projetos',
    exact: true,
    includeHidden: true,
  })
  await expect(goals).toBeVisible()
  await expect(projects).toBeVisible()
  const projectTab = page.getByRole('radio', { name: 'Projetos', exact: true })
  await projectTab.check()
  await expect(goals).toBeHidden()
  await expect(projects).toBeVisible()
  await projectTab.press('ArrowLeft')
  await expect(
    page.getByRole('radio', { name: 'Metas', exact: true }),
  ).toBeChecked()
  await expect(goals).toBeVisible()
  await expect(projects).toBeHidden()
  await page.getByRole('radio', { name: 'Tudo', exact: true }).check()
  await page.getByLabel('Buscar metas e projetos').fill('Atlas')
  await expect(projects.getByRole('list')).toContainText('Atlas')
  await expect(goals).toContainText('Nenhuma meta')
})

test('Seek e dock mantêm teclado, texto 200%, temas e movimento reduzido', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['Claro', 'Escuro']) {
      await page.goto('/')
      await expect(page.locator('main h1')).toBeVisible()
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page
        .getByRole('checkbox', { name: 'Reduzir transparência' })
        .check()
      await page.keyboard.press('Escape')
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      await page
        .getByRole('button', { name: 'Capturar ou navegar', exact: true })
        .press('Enter')
      const input = page.getByRole('textbox', {
        name: 'Captura global',
        exact: true,
      })
      await expect(input).toBeFocused()
      await input.fill('Uma ideia por vez')
      await expect(input).toHaveValue('Uma ideia por vez')
      expect(
        await page
          .locator('header.toolbar button:visible, header.toolbar a:visible')
          .evaluateAll((controls) =>
            controls.every((control) => {
              const rect = control.getBoundingClientRect()
              return rect.width >= 44 && rect.height >= 44
            }),
          ),
      ).toBe(true)
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
      await input.press('Escape')
      await expect(
        page.getByRole('button', { name: 'Capturar ou navegar', exact: true }),
      ).toBeFocused()
      await expect(page.locator('.toolbar')).toHaveCSS(
        'backdrop-filter',
        'none',
      )
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/redesign-9a-text200-${width}-${theme}.png`,
        ),
      })
    }
  }
})

test('dock segue a rolagem, perfil fica na navegação e preferências no cabeçalho', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const dock = page.getByRole('navigation', { name: 'Navegação principal' })
  await expect(dock).toBeVisible()
  const before = await dock.boundingBox()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  expect((await dock.boundingBox())?.y).toBe(before?.y)
  await expect(page.locator('.workspace-footer a')).toHaveCount(0)
  await expect(
    page
      .locator('header.toolbar')
      .getByRole('link', { name: 'Preferências', exact: true }),
  ).toBeVisible()
  await dock.getByRole('link', { name: 'Meu perfil', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/perfil/u)
  await expect(page.locator('main h1')).toBeFocused()
  await page.setViewportSize({ width: 375, height: 800 })
  const mobile = page.getByRole('navigation', { name: 'Navegação inferior' })
  await expect(mobile.locator('a, button')).toHaveCount(5)
  await expect(mobile.getByRole('link', { name: 'Meu perfil' })).toBeVisible()
  await mobile.getByRole('button', { name: 'Mais páginas' }).press('Enter')
  await page.getByRole('link', { name: 'Estudos', exact: true }).press('Enter')
  await expect(page.locator('main h1')).toHaveText('Estudos')
})

test('Seek foca, preserva rascunho no Escape e encaminha à command palette original', async ({
  page,
}) => {
  await page.goto('/')
  const trigger = page.getByRole('button', {
    name: 'Capturar ou navegar',
    exact: true,
  })
  await trigger.press('Enter')
  const input = page.getByRole('textbox', {
    name: 'Captura global',
    exact: true,
  })
  await expect(input).toBeFocused()
  await input.fill('nota: Uma ideia silenciosa')
  await input.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(input).toHaveValue('nota: Uma ideia silenciosa')
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await input.press('Enter')
  const palette = page.getByRole('dialog', { name: 'Captura rápida' })
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('combobox')).toHaveValue(
    'nota: Uma ideia silenciosa',
  )
  await page.keyboard.press('Escape')
  await expect(input).toBeFocused()
  await page.keyboard.press('Control+k')
  await expect(palette).toBeVisible()
})

test('toast desaparece, desfazer permanece disponível e recuperação preserva a tarefa', async ({
  page,
}) => {
  await page.goto('/tarefas')
  await page.clock.install()
  const input = page.getByLabel('Captura rápida', { exact: true })
  await input.fill('Teste de aviso passageiro')
  await input.press('Enter')
  await page
    .getByRole('button', {
      name: 'Editar Teste de aviso passageiro',
      exact: true,
    })
    .click()
  await page
    .getByRole('button', { name: 'Excluir tarefa', exact: true })
    .click()
  const confirmation = page.getByRole('alertdialog', {
    name: 'Excluir esta tarefa?',
  })
  await expect(
    confirmation.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await confirmation
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(page.locator('.transient-toast')).toContainText(/excluída/u)
  await page.mouse.move(0, 0)
  await page.clock.fastForward(8100)
  await expect(page.locator('.transient-toast')).toHaveCount(0)
  await page.getByText('Última exclusão', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Desfazer exclusão', exact: true })
    .press('Enter')
  await expect(
    page.getByRole('button', {
      name: 'Editar Teste de aviso passageiro',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Editar Teste de aviso passageiro',
      exact: true,
    }),
  ).toBeVisible()
})

test('calendário ancorado em desktop e sheet inferior em mobile preservam seleção e foco', async ({
  page,
}) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tarefas')
    await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
    const trigger = page.getByRole('button', {
      name: 'Abrir calendário: Prazo',
      exact: true,
    })
    await trigger.press('Enter')
    const calendar = page.getByRole('dialog', {
      name: 'Calendário: Prazo',
      exact: true,
    })
    await expect(calendar).toBeVisible()
    await expect(
      calendar.locator('.date-picker-day[tabindex="0"]'),
    ).toBeFocused()
    if (width > 760)
      await expect(page.locator('.date-picker-popover')).toBeVisible()
    else await expect(page.locator('.date-picker-sheet')).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(trigger).toBeFocused()
    await expect(page.getByLabel('Prazo', { exact: true })).not.toHaveValue('')
    await trigger.click()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Escape')
  }
})
