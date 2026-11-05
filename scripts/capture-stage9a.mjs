import { chromium, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'

// Disposable browser context; never uses the user's browser profile or data.
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  baseURL: 'http://127.0.0.1:4180',
  viewport: { width: 1280, height: 900 },
})
const page = await context.newPage()
const results = []
await mkdir('docs/screenshots', { recursive: true })
async function audit(name) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  results.push({ name, violations: result.violations })
  expect(result.violations).toEqual([])
}
try {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tarefas')
    await page.getByRole('radio', { name: 'Tabela', exact: true }).check()
    await page.getByRole('table').waitFor()
    await audit(`Tabela ${width}`)
    await page.screenshot({
      path: `docs/screenshots/etapa-9a-tabela-${width}.png`,
      fullPage: true,
    })
  }
  await page.goto('/notas')
  await page.locator('.note-row').first().hover()
  await page.locator('.note-hover-preview').waitFor()
  await page.screenshot({
    path: 'docs/screenshots/etapa-9a-hover-1280.png',
    fullPage: false,
  })
  await page.mouse.move(0, 0)
  await page
    .getByRole('button', { name: /Mostrar prévia de/ })
    .first()
    .click()
  await page.getByRole('dialog').waitFor()
  await audit('Prévia explícita')
  await page.screenshot({
    path: 'docs/screenshots/etapa-9a-previa-1280.png',
    fullPage: false,
  })
  await page.keyboard.press('Escape')
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tarefas')
    await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
    await page
      .getByRole('button', { name: 'Abrir calendário: Prazo', exact: true })
      .click()
    await page
      .getByRole('dialog', { name: 'Calendário: Prazo', exact: true })
      .waitFor()
    await audit(`Calendário ${width}`)
    await page.screenshot({
      path: `docs/screenshots/etapa-9a-datepicker-${width}.png`,
      fullPage: false,
    })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  }
  await writeFile(
    'docs/axe-stage9a-captures.json',
    JSON.stringify(results, null, 2) + '\n',
  )
  console.log(`${results.length} fluxos Axe aprovados; sete capturas gravadas.`)
} finally {
  await context.close()
  await browser.close()
}
