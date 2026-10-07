import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

test('backup real, importação, preservação, desfazer e persistência', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Seus dados' }).click()
  const panel = page.getByRole('dialog', { name: 'Seus dados' })
  await expect(panel.getByText('20 registros salvos localmente')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await panel
    .getByRole('button', { name: 'Exportar JSON', exact: true })
    .click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()
  const backup = await readFile(path!, 'utf8')
  expect(JSON.parse(backup)).toMatchObject({
    format: 'atlas',
    schemaVersion: 1,
  })

  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'aula.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '# Minha nota pessoal\n\nConteúdo que deve ser preservado.',
    ),
  })
  await expect(panel.getByText('Prévia: aula.md')).toBeVisible()
  await panel.getByRole('button', { name: 'Cancelar importação' }).click()
  await expect(panel.getByText('20 registros salvos localmente')).toBeVisible()
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'aula.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '# Minha nota pessoal\n\nConteúdo que deve ser preservado.',
    ),
  })
  await panel.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(panel.getByText('21 registros salvos localmente')).toBeVisible()
  await panel.getByRole('button', { name: 'Remover exemplos (20)' }).click()
  await expect(panel.getByText('1 registro salvo localmente')).toBeVisible()
  await page.reload()
  await page.goto('/notas')
  await expect(
    page.getByText('Minha nota pessoal', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Seus dados' }).click()
  await expect(panel.getByText('1 registro salvo localmente')).toBeVisible()
  await panel.getByRole('button', { name: 'Desfazer remoção' }).click()
  await expect(panel.getByText('21 registros salvos localmente')).toBeVisible()
  await panel.getByRole('button', { name: 'Remover exemplos (20)' }).click()
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  })
  await expect(
    panel.getByText('20 novos · 0 existentes serão preservados.'),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(panel.getByText('21 registros salvos localmente')).toBeVisible()
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  })
  await expect(
    panel.getByText('0 novos · 20 existentes serão preservados.'),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(
    panel.getByRole('button', { name: 'Remover exemplos (0)' }),
  ).toBeDisabled()
  await page.reload()
  await expect(
    page.getByText('Minha nota pessoal', { exact: true }),
  ).toBeVisible()
})

test('Markdown completo, erros acionáveis e sheet acessível em mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Seus dados' }).focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('dialog', { name: 'Seus dados' })
  const downloadPromise = page.waitForEvent('download')
  // Once loaded, local data operations do not need a network connection.
  await page.context().setOffline(true)
  await panel.getByRole('button', { name: 'Exportar Markdown' }).click()
  const download = await downloadPromise
  const path = await download.path()
  const backup = await readFile(path!, 'utf8')
  await panel.getByRole('button', { name: 'Remover exemplos (20)' }).click()
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'atlas.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(backup),
  })
  await panel.getByRole('button', { name: 'Confirmar importação' }).click()
  await expect(panel.getByText('20 registros salvos localmente')).toBeVisible()
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(panel.getByRole('alert')).toContainText('JSON inválido')
  await expect(panel.getByText('20 registros salvos localmente')).toBeVisible()
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: 'test-results/regression-dados-mobile.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Seus dados' })).toBeFocused()
  await page.context().setOffline(false)
  await page.getByRole('button', { name: 'Aparência' }).click()
  await page.getByRole('radio', { name: 'Claro', exact: true }).check()
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await page.getByRole('button', { name: 'Seus dados' }).click()
  await expect(
    panel.getByRole('button', { name: 'Escolher arquivo' }),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Escolher arquivo' }).focus()
  await expect(
    panel.getByRole('button', { name: 'Escolher arquivo' }),
  ).toBeInViewport()
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true)
  }
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
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
    path: 'test-results/regression-dados-texto-200.png',
  })
})

test('atualiza outra aba e informa bloqueio de armazenamento sem fingir sucesso', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(
    page.getByText('Revisar estruturas de dados', { exact: true }),
  ).toBeVisible()
  const second = await context.newPage()
  await second.goto('/')
  await second.getByRole('button', { name: 'Seus dados' }).click()
  await second.getByRole('button', { name: 'Remover exemplos (20)' }).click()
  await expect(
    page.getByText('Revisar estruturas de dados', { exact: true }),
  ).not.toBeVisible()
  await second.close()
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('blocked', 'SecurityError')
      },
    })
  })
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Seus dados não puderam ser abertos.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Tentar novamente' }),
  ).toBeVisible()
})
