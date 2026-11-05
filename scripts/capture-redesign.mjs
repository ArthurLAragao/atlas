import { chromium } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'

const phase = process.argv.includes('--after') ? 'after' : 'before'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4180' })
const page = await context.newPage()
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
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['dark', 'light']) {
      await page.goto('/')
      await page.locator('main h1').waitFor()
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
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
        if (view) {
          await page.getByRole('radio', { name: view, exact: true }).check()
          await page
            .getByText(/Abrindo (tabela|Kanban|calendário)/)
            .waitFor({ state: 'hidden' })
        }
        await page.screenshot({
          path: `docs/screenshots/redesign-9a-${phase}-${name}-${width}-${theme}.png`,
          fullPage: true,
        })
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
        let violations = []
        if (phase === 'after')
          violations = (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations
        results.push({ name, width, theme, overflow, violations })
      }
    }
    console.log(`${phase}: ${width} px capturados`)
  }
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto('/estudos')
  const cards = page.getByRole('button', { name: /Flashcards/ }).first()
  if (await cards.count()) {
    await cards.click()
    await page.screenshot({
      path: `docs/screenshots/redesign-9a-${phase}-flashcards.png`,
      fullPage: true,
    })
  }
  await page.goto('/')
  await page.locator('main h1').waitFor()
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog').waitFor()
  await page.screenshot({
    path: `docs/screenshots/redesign-9a-${phase}-palette.png`,
  })
  await page.keyboard.press('Escape')
  await page.goto('/tarefas')
  await page.locator('main h1').waitFor()
  await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.screenshot({
    path: `docs/screenshots/redesign-9a-${phase}-sheet.png`,
  })
  await page
    .getByRole('button', { name: 'Abrir calendário: Prazo', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Calendário: Prazo', exact: true })
    .waitFor()
  await page.locator('.date-picker-day[tabindex="0"]').waitFor()
  await page.screenshot({
    path: `docs/screenshots/redesign-9a-${phase}-datepicker.png`,
  })
  if (phase === 'after') {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/notas?note=example-note-0&edit=1')
      await page.getByLabel('Conteúdo Markdown', { exact: true }).waitFor()
      await page.screenshot({
        path: `docs/screenshots/redesign-9a-after-editor-${width}.png`,
        fullPage: true,
      })
      await page.goto('/notas')
      await page.locator('.note-peek-button').first().click()
      await page.getByRole('dialog').waitFor()
      await page.screenshot({
        path: `docs/screenshots/redesign-9a-after-note-preview-${width}.png`,
      })
      await page.keyboard.press('Escape')
    }
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.goto('/estudos')
    await page
      .getByRole('button', { name: 'Novo flashcard', exact: true })
      .click()
    const card = page.getByRole('dialog', {
      name: 'Novo flashcard',
      exact: true,
    })
    await card
      .getByLabel('Pergunta', { exact: true })
      .fill('Como funciona uma pilha?')
    await card
      .getByLabel('Resposta', { exact: true })
      .fill('O último elemento a entrar é o primeiro a sair.')
    await card
      .getByRole('button', { name: 'Salvar flashcard', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Revelar resposta', exact: true })
      .click()
    await page.screenshot({
      path: 'docs/screenshots/redesign-9a-after-flashcards.png',
      fullPage: true,
    })
    await page.goto('/notas')
    await page
      .getByRole('button', { name: 'Importar Markdown', exact: true })
      .click()
    await page
      .getByRole('dialog', { name: 'Importar Markdown', exact: true })
      .waitFor()
    await page.screenshot({
      path: 'docs/screenshots/redesign-9a-after-markdown-import.png',
    })
    await page.keyboard.press('Escape')
    await page.goto('/')
    await page.locator('main h1').waitFor()
    await page
      .getByRole('button', { name: 'Capturar ou navegar', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Captura global', exact: true })
      .fill('Uma ideia por vez')
    await page.locator('.seek-capture').evaluate(async (capture) => {
      await Promise.all(
        capture
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      )
    })
    await page.screenshot({
      path: 'docs/screenshots/redesign-9a-after-seek.png',
    })
  }
  await writeFile(
    `docs/visual-${phase}-redesign.json`,
    JSON.stringify(results, null, 2) + '\n',
  )
  const assets = []
  for (const name of await readdir('dist/assets'))
    assets.push({ name, bytes: (await stat('dist/assets/' + name)).size })
  await writeFile(
    `docs/bundle-${phase}-redesign.json`,
    JSON.stringify(
      { assets, total: assets.reduce((n, a) => n + a.bytes, 0) },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `${results.length} capturas; ${results.filter((r) => r.overflow || r.violations.length).length} resultados a revisar`,
  )
} finally {
  await context.close()
  await browser.close()
}
