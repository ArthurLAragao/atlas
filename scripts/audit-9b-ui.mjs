import { chromium } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'

// A new nonpersistent context: no user tab/profile or personal origin storage.
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  baseURL: 'http://127.0.0.1:4180',
  reducedMotion: 'reduce',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const routes = [
  ['hoje', '/'],
  ['tarefas-lista', '/tarefas'],
  ['tarefas-kanban', '/tarefas', 'Kanban'],
  ['tarefas-tabela', '/tarefas', 'Tabela'],
  ['tarefas-calendario', '/tarefas', 'Calendário'],
  ['habitos', '/habitos'],
  ['notas', '/notas'],
  ['metas', '/metas'],
  ['estudos', '/estudos'],
  ['foco', '/foco'],
  ['perfil', '/perfil'],
  ['preferencias', '/preferencias'],
]
const results = []
await mkdir('docs/screenshots', { recursive: true })
try {
  await page.goto('/preferencias')
  await page.getByLabel('Transparência', { exact: true }).selectOption('reduce')
  await page.reload()
  if (
    (await page.locator('html').getAttribute('data-transparency')) !== 'reduce'
  )
    throw new Error('Preferência de transparência reduzida não persistiu')
  for (const textPercent of [100, 200]) {
    for (const width of [375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['dark', 'light']) {
        await page.goto('/')
        await page.locator('main h1').waitFor()
        await page
          .getByRole('button', { name: 'Aparência', exact: true })
          .click()
        await page
          .getByRole('radio', {
            name: theme === 'dark' ? 'Escuro' : 'Claro',
            exact: true,
          })
          .check()
        await page.keyboard.press('Escape')
        for (const [name, path, view] of routes) {
          await page.goto(path)
          await page.locator('main h1').waitFor()
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}%`
          }, textPercent)
          if (view) {
            await page.getByRole('radio', { name: view, exact: true }).check()
            await page
              .getByText(/Abrindo (tabela|Kanban|calendário)/)
              .waitFor({ state: 'hidden' })
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          )
          const violations = (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations
          results.push({
            name,
            width,
            theme,
            textPercent,
            overflow,
            violations,
          })
          if (
            (width === 375 || width === 1440) &&
            textPercent === 200 &&
            ['hoje', 'habitos', 'perfil', 'tarefas-tabela'].includes(name)
          )
            await page.screenshot({
              path: `docs/screenshots/audit-9b-${name}-${width}-${theme}-200.png`,
              fullPage: true,
            })
        }
      }
      console.log(`Axe/layout: ${width} px, texto ${textPercent}% concluído`)
    }
  }
} finally {
  await writeFile(
    'docs/accessibility-9b.json',
    JSON.stringify({ results, errors }, null, 2) + '\n',
  )
  await context.close()
  await browser.close()
}
const failures = results.filter((row) => row.overflow || row.violations.length)
console.log(
  JSON.stringify({ states: results.length, failures, errors }, null, 2),
)
if (failures.length || errors.length) process.exitCode = 1
