import { chromium } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const results = []
try {
  for (const width of [1280, 375]) {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4180',
      viewport: { width, height: 900 },
    })
    try {
      const page = await context.newPage()
      await page.goto('/tarefas')
      const input = page.getByLabel('Captura rápida', { exact: true })
      await input.fill('Revisar uma decisão com calma')
      await input.press('Enter')
      await page
        .getByRole('button', {
          name: 'Editar Revisar uma decisão com calma',
          exact: true,
        })
        .click()
      await page
        .getByRole('button', { name: 'Excluir tarefa', exact: true })
        .click()
      const dialog = page.getByRole('alertdialog', {
        name: 'Excluir esta tarefa?',
      })
      await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()
      const toast = page.locator('.transient-toast')
      await toast.waitFor()
      await toast.evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished.catch(() => undefined)),
        )
      })
      await page.screenshot({
        path: `docs/screenshots/redesign-9a-after-toast-${width}.png`,
      })
      const violations = (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
      results.push({ width, violations })
      if (violations.length)
        throw new Error(`Axe encontrou falhas em ${width}px`)
    } finally {
      await context.close()
    }
  }
  await writeFile(
    'docs/feedback-redesign-9a.json',
    JSON.stringify(results, null, 2) + '\n',
  )
} finally {
  await browser.close()
}
