import { evidencePath } from './evidence.js'
import { chooseMenu } from './menu-helpers.js'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile, mkdir } from 'node:fs/promises'
import { emptySnapshot, type Snapshot, type Note } from '../src/data/models.js'

test.use({ actionTimeout: 15000 })
const now = new Date().toISOString()
const note = (
  id: string,
  title: string,
  content = '# Ideia\n\nUma anotação útil.',
): Note => ({
  id,
  title,
  content,
  tags: ['estudo'],
  links: [],
  createdAt: now,
  updatedAt: now,
  isExample: false,
  archivedAt: null,
})
async function backup(page: Page): Promise<Snapshot> {
  await page.goto('/preferencias')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  return (
    JSON.parse(await readFile((await (await download).path())!, 'utf8')) as {
      data: Snapshot
    }
  ).data
}
async function importData(page: Page, data: Snapshot) {
  await page.goto('/preferencias')
  await page
    .getByLabel('Arquivo para importar', { exact: true })
    .setInputFiles({
      name: 'atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'atlas',
          schemaVersion: 1,
          exportedAt: now,
          data,
        }),
      ),
    })
  await page
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(page.locator('.import-preview')).not.toBeVisible()
}
async function importDialog(page: Page) {
  await page.goto('/notas')
  await page
    .getByRole('button', { name: 'Importar Markdown', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Importar Markdown',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  return dialog
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(result.violations).toEqual([])
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
}

test('componentes sob demanda funcionam offline: Markdown, prévia, Tabela, datas e perfil', async ({
  page,
  context,
}) => {
  await page.goto('/preferencias')
  await expect(
    page.getByText('App preparado para recarga offline neste navegador.'),
  ).toBeVisible({ timeout: 30000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true)
  await context.setOffline(true)
  await page.reload()
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await expect(page.getByText(/Você está offline/)).toBeVisible()
  const imported = await importDialog(page)
  await imported
    .getByLabel('Arquivos Markdown', { exact: true })
    .setInputFiles({
      name: 'Nota offline 9A.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '# Nota offline 9A\n\nTexto local que funciona sem rede.',
      ),
    })
  await imported
    .getByRole('button', { name: 'Importar 1 nota', exact: true })
    .click()
  await expect(imported.getByRole('status')).toContainText('1 importadas')
  await imported.getByRole('button', { name: 'Concluir importação' }).click()
  await page
    .getByRole('button', {
      name: 'Mostrar prévia de Nota offline 9A',
      exact: true,
    })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Texto local que funciona sem rede.',
  )
  await axe(page)
  await page.keyboard.press('Escape')
  await page.goto('/tarefas')
  const input = page.getByLabel('Captura rápida', { exact: true })
  await input.fill('Tarefa offline 9A amanhã')
  await input.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Editar Tarefa offline 9A', exact: true }),
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Tabela', exact: true }).check()
  await expect(page.getByRole('table')).toContainText('Tarefa offline 9A')
  await axe(page)
  await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
  await page
    .getByRole('button', { name: 'Abrir calendário: Prazo', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Calendário: Prazo', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.date-picker-day[tabindex="0"]')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Prazo', { exact: true })).not.toHaveValue('')
  await page.keyboard.press('Escape')
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page.getByLabel('Nome de exibição').fill('Perfil offline 9A')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await page.reload()
  await expect(
    page.getByRole('heading', {
      name: 'Perfil offline 9A',
      exact: true,
      level: 1,
    }),
  ).toBeVisible()
  await axe(page)
  const saved = await backup(page)
  expect(saved.profile?.name).toBe('Perfil offline 9A')
  expect(saved.notes.some((n) => n.title === 'Nota offline 9A')).toBe(true)
  expect(saved.tasks.some((t) => t.title === 'Tarefa offline 9A')).toBe(true)
})

test('perfil privado: edição, atividade deduplicada, fixados e backup com limpeza forte', async ({
  page,
}) => {
  await page.goto('/perfil')
  const edit = page.getByRole('button', { name: 'Editar perfil', exact: true })
  await edit.click()
  const dialog = page.getByRole('dialog', {
    name: 'Editar perfil',
    exact: true,
  })
  await expect(dialog.getByLabel('Nome de exibição')).toBeFocused()
  await dialog.getByLabel('Nome de exibição').fill('Pessoa Exemplo — local')
  await dialog.getByLabel('Identificador opcional').fill('@pessoa_exemplo')
  await dialog.getByLabel('Uma frase sua').fill('Um dia de cada vez.')
  await dialog.getByRole('button', { name: 'Salvar perfil' }).click()
  await expect(edit).toBeFocused()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Pessoa Exemplo — local', exact: true, level: 1 }),
  ).toBeVisible()
  for (const [path, title] of [
    ['/metas?project=example-project', 'Atlas'],
    ['/metas?goal=example-goal', 'Concluir trilha AWS'],
  ] as const) {
    await page.goto(path)
    await page
      .getByRole('button', { name: 'Fixar no perfil', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Desafixar do perfil', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(title).toBeTruthy()
  }
  await page.goto('/tarefas')
  const capture = page.getByLabel('Captura rápida', { exact: true })
  await capture.fill('Atividade confiável hoje')
  await capture.press('Enter')
  const check = page
    .locator('[data-task-id]')
    .filter({ hasText: 'Atividade confiável' })
    .locator('.task-check')
  await check.click()
  await expect(check).toHaveAttribute('aria-pressed', 'true')
  await check.click()
  await check.click()
  await page.goto('/perfil')
  await expect(
    page.getByText('Concluiu Atividade confiável', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Ver em texto', exact: true }).click()
  await expect(page.locator('.activity-text')).toBeVisible()
  await page.getByLabel('Período', { exact: true }).selectOption('52')
  await axe(page)
  await page.getByRole('button', { name: 'Ver gráfico', exact: true }).click()
  await page.getByLabel('Período', { exact: true }).selectOption('13')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await mkdir('docs/screenshots', { recursive: true })
  await page.screenshot({
    path: evidencePath(
      'docs/screenshots/etapa-9a-perfil-com-atividade-1280.png',
    ),
    fullPage: true,
  })
  const before = await backup(page)
  expect(before.profile?.pinned).toHaveLength(2)
  expect(
    before.activity.filter((e) => e.title === 'Atividade confiável'),
  ).toHaveLength(1)
  await page
    .getByRole('button', { name: 'Limpar todos os dados', exact: true })
    .click()
  const clear = page.getByRole('dialog', {
    name: 'Apagar todos os dados?',
    exact: true,
  })
  await expect(
    clear.getByRole('button', { name: 'Manter meus dados', exact: true }),
  ).toBeFocused()
  await expect(
    clear.getByRole('button', { name: 'Exportar backup antes de limpar' }),
  ).toBeVisible()
  await clear.getByLabel('Digite APAGAR TUDO').fill('APAGAR TUDO')
  await clear.getByRole('checkbox', { name: /Entendo que a limpeza/ }).check()
  await clear.getByRole('button', { name: 'Apagar definitivamente' }).click()
  const empty = await backup(page)
  expect(empty.profile).toBeNull()
  expect(empty.activity).toEqual([])
  await importData(page, before)
  await importData(page, before)
  const restored = await backup(page)
  expect(restored.profile).toEqual(before.profile)
  expect(restored.activity).toEqual(before.activity)
  await page.goto('/metas?project=example-project')
  await page
    .getByRole('button', { name: 'Desafixar do perfil', exact: true })
    .click()
  expect((await backup(page)).profile?.pinned).toHaveLength(1)
})

test('prévia: atraso intencional, cancelamento, limites, teclado e touch', async ({
  page,
}) => {
  const data = emptySnapshot()
  data.notes = [
    note(
      'preview',
      'Prévia local',
      '# Conteúdo\n\n**Trecho legível** e [[Outro]].\n\n' +
        'texto '.repeat(400),
    ),
  ]
  await importData(page, data)
  await page.goto('/notas')
  const row = page
    .locator('.note-row-group')
    .filter({ hasText: 'Prévia local' })
  await row.scrollIntoViewIfNeeded()
  await row.hover()
  await page.waitForTimeout(250)
  await expect(page.locator('.note-hover-preview')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(650)
  await expect(page.locator('.note-hover-preview')).toHaveCount(0)
  await row.hover()
  await expect(page.locator('.note-hover-preview')).toBeVisible()
  const bounds = await page.locator('.note-hover-preview').boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  )
  await page.mouse.wheel(0, 80)
  await expect(page.locator('.note-hover-preview')).toHaveCount(0)
  const button = row.getByRole('button', {
    name: 'Mostrar prévia de Prévia local',
    exact: true,
  })
  await button.focus()
  await button.press('Enter')
  await expect(
    page.getByRole('dialog', { name: 'Prévia: Prévia local' }),
  ).toBeVisible()
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(button).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 900 })
  await button.click()
  await expect(page.getByRole('dialog')).toContainText('Trecho legível')
  await noOverflow(page)
})

test('avatar local é limitado, convertido e persistido; trilhas podem ser fixadas', async ({
  page,
}) => {
  const data = await backup(page)
  await page.goto(`/estudos?path=${data.studyPaths[0]!.id}`)
  await page
    .getByRole('button', { name: 'Fixar no perfil', exact: true })
    .click()
  await page.goto('/perfil')
  await expect(page.locator('.profile-pinned')).toContainText(
    data.studyPaths[0]!.title,
  )
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Editar perfil', exact: true })
  await sheet.getByLabel('Imagem local opcional').setInputFiles({
    name: 'invalid.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  })
  await expect(sheet.getByRole('alert')).toContainText('PNG, JPEG ou WebP')
  await sheet
    .getByLabel('Imagem local opcional')
    .setInputFiles('public/icons/atlas-192.png')
  await expect(
    sheet.getByRole('button', { name: 'Usar iniciais', exact: true }),
  ).toBeVisible()
  await sheet.getByLabel('Nome de exibição').fill('Avatar local')
  await sheet
    .getByRole('button', { name: 'Salvar perfil', exact: true })
    .click()
  await page.reload()
  await expect(page.locator('.profile-avatar img')).toHaveAttribute(
    'src',
    /^data:image\/webp;base64,/,
  )
  expect(
    await page
      .locator('.profile-avatar img')
      .evaluate((img: HTMLImageElement) => [
        img.naturalWidth,
        img.naturalHeight,
      ]),
  ).toEqual([256, 256])
  const saved = await backup(page)
  expect(saved.profile?.avatar?.length).toBeLessThanOrEqual(350000)
  await page.goto(`/estudos?path=${data.studyPaths[0]!.id}`)
  await page
    .getByRole('button', { name: 'Desafixar do perfil', exact: true })
    .click()
  expect((await backup(page)).profile?.pinned).toEqual([])
  await page.goto(`/estudos?path=${data.studyPaths[0]!.id}`)
  await page
    .getByRole('button', { name: 'Fixar no perfil', exact: true })
    .click()
  await page.goto('/preferencias')
  await page.getByRole('button', { name: /Remover exemplos/ }).click()
  await expect(
    page.getByRole('button', { name: /Remover exemplos/ }),
  ).toBeDisabled()
  await page.goto('/perfil')
  const unavailable = page.getByRole('region', {
    name: 'Fixados indisponíveis',
  })
  await expect(unavailable).toContainText('Trilha indisponível')
  await unavailable.getByRole('button', { name: 'Desafixar do perfil' }).click()
  await expect(unavailable).not.toBeVisible()
  expect((await backup(page)).profile?.pinned).toEqual([])
})

test('Tabela mantém todos os registros de uma lista densa por paginação acessível', async ({
  page,
}) => {
  const existing = await backup(page),
    data = emptySnapshot()
  data.tasks = Array.from({ length: 205 }, (_, index) => ({
    ...existing.tasks[0]!,
    id: `dense-${index}`,
    title: `Densa ${index}`,
    links: [],
    status: 'todo',
    repeat: null,
    subtasks: [],
    isExample: false,
  }))
  await importData(page, data)
  await page.goto('/tarefas')
  await page.getByLabel('Buscar tarefas').fill('Densa')
  await page.getByRole('radio', { name: 'Tabela', exact: true }).check()
  await expect(page.locator('.task-table tbody tr')).toHaveCount(200)
  await page
    .getByRole('button', { name: 'Próxima página', exact: true })
    .press('Enter')
  await expect(page.locator('.task-table tbody tr')).toHaveCount(5)
  await expect(
    page.getByRole('button', { name: 'Próxima página', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Página anterior', exact: true })
    .press('Enter')
  await expect(page.locator('.task-table tbody tr')).toHaveCount(200)
})

test('captura compacta: foco, Escape preserva rascunho, parser, repetição e persistência', async ({
  page,
}) => {
  await page.goto('/tarefas')
  const input = page.getByLabel('Captura rápida', { exact: true })
  await expect(
    page.locator('.compact-capture-line > button[aria-expanded]'),
  ).toHaveAttribute('aria-expanded', 'false')
  await input.focus()
  await expect(input).toBeFocused()
  await expect(
    page.locator('.compact-capture-line > button[aria-expanded]'),
  ).toHaveAttribute('aria-expanded', 'true')
  await input.fill('estudar AWS amanhã 19h #faculdade !alta')
  await expect(page.getByLabel('Interpretação da captura')).toContainText(
    '19:00',
  )
  await input.press('Escape')
  const discard = page.getByRole('alertdialog', {
    name: 'Descartar esta captura?',
  })
  await expect(
    discard.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(input).toHaveValue('estudar AWS amanhã 19h #faculdade !alta')
  await chooseMenu(page, page.getByLabel('Contexto da captura'), 'Faculdade')
  await chooseMenu(
    page,
    page.getByLabel('Repetição da captura'),
    'Semanalmente',
  )
  await input.press('Shift+Enter')
  await expect(
    page.getByRole('button', { name: 'Editar estudar AWS', exact: true }),
  ).toHaveCount(0)
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await expect(
    page.locator('.compact-capture-line > button[aria-expanded]'),
  ).toHaveAttribute('aria-expanded', 'false')
  await expect(input).toBeFocused()
  await page.reload()
  const data = await backup(page)
  expect(data.tasks.find((t) => t.title === 'estudar AWS')).toMatchObject({
    dueTime: '19:00',
    tags: ['faculdade'],
    priority: 'high',
    context: 'Faculdade',
    repeat: { unit: 'week', interval: 1 },
  })
  await page.goto('/notas')
  const title = page.getByLabel('Título da nova nota', { exact: true })
  await expect(
    page.locator('.compact-capture-line > button[aria-expanded]'),
  ).toHaveAttribute('aria-expanded', 'false')
  await title.fill('Ideia capturada')
  await title.press('Enter')
  await expect(
    page.getByLabel('Conteúdo Markdown', { exact: true }),
  ).toBeFocused()
  await expect(page.getByLabel('Título da nota', { exact: true })).toHaveValue(
    'Ideia capturada',
  )
})

test('exclusão: Cancelar, Escape, foco seguro e desfazer conservam conteúdo', async ({
  page,
}) => {
  const data = emptySnapshot()
  data.notes = [
    note('delete-confirm', 'Nota importante', '# Dados\n[[Ligação]]'),
  ]
  await importData(page, data)
  await page.goto('/notas?note=delete-confirm&edit=1')
  const trigger = page.getByRole('button', {
    name: 'Excluir nota',
    exact: true,
  })
  await trigger.click()
  let dialog = page.getByRole('alertdialog', { name: 'Excluir esta nota?' })
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  dialog = page.getByRole('alertdialog')
  await axe(page)
  await dialog
    .getByRole('button', { name: 'Excluir', exact: true })
    .press('Enter')
  await page
    .getByRole('button', { name: 'Desfazer última ação em notas', exact: true })
    .click()
  expect(
    (await backup(page)).notes.find((n) => n.id === 'delete-confirm'),
  ).toEqual(data.notes[0])
})

for (const reduced of [false, true]) {
  test(`conclusão em Lista, Kanban, Tabela e Hoje; movimento reduzido ${reduced}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    })
    await page.goto('/tarefas')
    const capture = page.getByLabel('Captura rápida', { exact: true })
    await capture.fill('Concluir passo hoje')
    await capture.press('Enter')
    for (const view of ['Lista', 'Kanban', 'Tabela']) {
      await page.getByRole('radio', { name: view, exact: true }).check()
      const check = page
        .locator('[data-task-id]')
        .filter({ hasText: 'Concluir passo' })
        .locator('.task-check')
      await check.click()
      await expect(check).toHaveAttribute(
        view === 'Tabela' ? 'aria-checked' : 'aria-pressed',
        'true',
      )
      await expect(check).toBeFocused()
      await check.click()
      await expect(check).toHaveAttribute(
        view === 'Tabela' ? 'aria-checked' : 'aria-pressed',
        'false',
      )
    }
    await page.goto('/')
    const check = page
      .locator('[data-task-id]')
      .filter({ hasText: 'Concluir passo' })
      .locator('.task-check')
    await check.click()
    await expect(check).toHaveAttribute('aria-pressed', 'true')
    await expect(check).toBeFocused()
    expect(
      (await backup(page)).activity.filter((e) => e.title === 'Concluir passo'),
    ).toHaveLength(1)
  })
}

test('Tabela: contagens reais e filtros compostos, Kanban por teclado em mobile', async ({
  page,
}) => {
  await page.goto('/tarefas')
  for (const title of ['Tabela Alpha', 'Tabela Beta']) {
    await page.getByLabel('Captura rápida', { exact: true }).fill(title)
    await chooseMenu(page, page.getByLabel('Contexto da captura'), 'Projetos')
    await page.getByLabel('Captura rápida', { exact: true }).press('Enter')
  }
  await page.getByLabel('Buscar tarefas').fill('Tabela')
  await chooseMenu(page, page.getByLabel('Filtrar contexto'), 'Projetos')
  await page.getByRole('radio', { name: 'Tabela', exact: true }).check()
  await expect(
    page.getByRole('radio', { name: 'Todas (2)', exact: true }),
  ).toBeChecked()
  await chooseMenu(
    page,
    page.getByRole('combobox', {
      name: 'Situação de Tabela Alpha',
      exact: true,
    }),
    'Fazendo',
  )
  await expect(
    page.getByRole('radio', { name: 'Fazendo (1)', exact: true }),
  ).toBeVisible()
  await page.getByRole('radio', { name: 'Fazendo (1)', exact: true }).check()
  await expect(page.locator('.task-table tbody tr')).toHaveCount(1)
  await page.setViewportSize({ width: 375, height: 900 })
  const region = page.getByRole('region', {
    name: 'Tabela de tarefas, com rolagem horizontal',
  })
  await region.focus()
  await region.press('ArrowRight')
  await noOverflow(page)
  await axe(page)
  await chooseMenu(page, page.getByLabel('Filtrar situação'), 'Todas')
  await page.getByRole('radio', { name: 'Kanban', exact: true }).check()
  await expect(page.locator('.task-board')).toBeVisible()
  await expect(
    page.getByLabel('Situação de Tabela Beta', { exact: true }),
  ).toBeEnabled()
  await page.getByLabel('Situação de Tabela Beta', { exact: true }).focus()
  await expect(
    page.getByLabel('Situação de Tabela Beta', { exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'A fazer', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'Fazendo', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByLabel('Situação de Tabela Beta', { exact: true }),
  ).toHaveAttribute('data-value', 'doing')
  await noOverflow(page)
  await page
    .getByRole('button', { name: 'Adicionar em Fazendo', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Tabela contextual')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Criar tarefa', exact: true })
    .click()
  await chooseMenu(
    page,
    page.getByLabel('Filtrar contexto'),
    'Todos os contextos',
  )
  await expect(
    page
      .locator('[data-drop-status=doing]')
      .getByLabel('Situação de Tabela contextual', { exact: true }),
  ).toHaveAttribute('data-value', 'doing')
})

test('falha de persistência reverte conclusão e permite tentar novamente', async ({
  page,
}) => {
  await page.goto('/tarefas')
  const input = page.getByLabel('Captura rápida', { exact: true })
  await input.fill('Conclusão segura')
  await input.press('Enter')
  const check = page.getByRole('button', {
    name: 'Concluir Conclusão segura',
    exact: true,
  })
  await expect(check).toBeVisible()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'tasks') {
        IDBObjectStore.prototype.put = original
        throw new DOMException(
          'Falha simulada para verificar recuperação',
          'QuotaExceededError',
        )
      }
      return original.apply(this, args)
    }
  })
  await check.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(check).toHaveAttribute('aria-pressed', 'false')
  expect(
    (await backup(page)).tasks.find((t) => t.title === 'Conclusão segura')
      ?.status,
  ).toBe('todo')
  await page.goto('/tarefas')
  await page
    .getByRole('button', { name: 'Concluir Conclusão segura', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Reabrir Conclusão segura', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('Markdown: múltiplos, fallback, cancelamento, duplicatas, persistência e backup', async ({
  page,
}) => {
  let dialog = await importDialog(page)
  const payload = [
    {
      name: 'Aula.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '---\nid: imported-a\ntitle: "Aula importada"\ntags: ["faculdade"]\n---\n# Aula\n[[Sem título]]',
      ),
    },
    {
      name: 'Sem título.md',
      mimeType: 'text/plain',
      buffer: Buffer.from('Conteúdo sem título.'),
    },
  ]
  await dialog
    .getByLabel('Arquivos Markdown', { exact: true })
    .setInputFiles(payload)
  await expect(
    dialog.getByText('Sem título: usamos o nome do arquivo.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  expect((await backup(page)).notes.some((n) => n.id === 'imported-a')).toBe(
    false,
  )
  dialog = await importDialog(page)
  await dialog
    .getByLabel('Arquivos Markdown', { exact: true })
    .setInputFiles(payload)
  await axe(page)
  await dialog
    .getByRole('button', { name: 'Importar 2 notas', exact: true })
    .click()
  await expect(dialog.getByRole('status')).toContainText('2 importadas')
  await dialog.getByRole('button', { name: 'Concluir importação' }).click()
  await page.reload()
  await expect(
    page.getByRole('link').filter({ hasText: 'Aula importada' }),
  ).toBeVisible()
  const before = await backup(page)
  expect(before.notes.find((n) => n.id === 'imported-a')).toMatchObject({
    title: 'Aula importada',
    content: '# Aula\n[[Sem título]]',
    tags: ['faculdade'],
  })
  dialog = await importDialog(page)
  await dialog.getByLabel('Arquivos Markdown').setInputFiles(payload)
  await expect(
    dialog.getByRole('button', { name: 'Importar 0 notas', exact: true }),
  ).toBeDisabled()
  await dialog.getByLabel('Notas duplicadas').selectOption('ignore')
  await dialog
    .getByRole('button', { name: 'Importar 0 notas', exact: true })
    .click()
  await expect(dialog.getByRole('status')).toContainText('2 ignoradas')
  await dialog.getByRole('button', { name: 'Concluir importação' }).click()
  dialog = await importDialog(page)
  await dialog
    .getByLabel('Arquivos Markdown')
    .setInputFiles(payload.slice(0, 1))
  await dialog.getByLabel('Notas duplicadas').selectOption('copy')
  await dialog
    .getByRole('button', { name: 'Importar 1 nota', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Concluir importação' }).click()
  const after = await backup(page)
  expect(after.notes.filter((n) => n.title === 'Aula importada')).toHaveLength(
    2,
  )
  await importData(page, after)
  expect((await backup(page)).notes).toEqual(after.notes)
})

test('Markdown rejeita extensão, tamanho, excesso de arquivos e HTML ativo; descarte preserva foco', async ({
  page,
}) => {
  const dialog = await importDialog(page)
  const input = dialog.getByLabel('Arquivos Markdown')
  for (const [file, message] of [
    [
      {
        name: 'invalido.html',
        mimeType: 'text/plain',
        buffer: Buffer.from('# X'),
      },
      'Use somente arquivos .md',
    ],
    [
      {
        name: 'grande.md',
        mimeType: 'text/markdown',
        buffer: Buffer.alloc(1024 * 1024 + 1, 97),
      },
      'supera 1 MB',
    ],
    [
      {
        name: 'ativo.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('<script>alert(1)</script>'),
      },
      'HTML ativo não é aceito',
    ],
  ] as const) {
    await input.setInputFiles(file)
    await expect(dialog.getByText(message, { exact: false })).toBeVisible()
  }
  await input.setInputFiles(
    Array.from({ length: 21 }, (_, i) => ({
      name: `${i}.md`,
      mimeType: 'text/plain',
      buffer: Buffer.from('# Nota'),
    })),
  )
  await expect(dialog.getByRole('alert')).toContainText('20 arquivos')
  await input.setInputFiles({
    name: 'rascunho.md',
    mimeType: 'text/plain',
    buffer: Buffer.from('# Teste'),
  })
  await dialog
    .getByRole('button', { name: 'Remover rascunho.md da seleção' })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(dialog.locator('.markdown-dropzone')).toBeFocused()
  await expect(dialog.locator('.markdown-files li')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Importar Markdown', exact: true }),
  ).toBeFocused()
})

for (const theme of ['dark', 'light']) {
  test(`design alterado ${theme}: Axe, 375/768/1280, 200%, transparência e movimento reduzidos`, async ({
    page,
  }) => {
    await page.goto('/preferencias')
    await page.getByLabel('Tema', { exact: true }).selectOption(theme)
    await page.getByLabel('Movimento', { exact: true }).selectOption('reduce')
    await page
      .getByLabel('Transparência', { exact: true })
      .selectOption('reduce')
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const path of ['/perfil', '/tarefas', '/notas']) {
        await page.goto(path)
        await page.getByRole('heading', { level: 1 }).waitFor()
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
        if (path === '/tarefas') {
          await page.getByRole('radio', { name: 'Tabela', exact: true }).check()
        }
        await noOverflow(page)
        await axe(page)
      }
      await page.goto('/tarefas')
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      await page
        .getByRole('button', { name: 'Nova tarefa', exact: true })
        .click()
      await page
        .getByRole('button', { name: 'Abrir calendário: Prazo', exact: true })
        .click()
      const calendar = page.getByRole('dialog', {
        name: 'Calendário: Prazo',
        exact: true,
      })
      await expect(
        calendar.locator('.date-picker-day[tabindex="0"]'),
      ).toBeFocused()
      const selected = await calendar
        .locator('.date-picker-day[tabindex="0"]')
        .getAttribute('aria-label')
      await page.keyboard.press('ArrowRight')
      expect(
        await calendar
          .locator('.date-picker-day[tabindex="0"]')
          .getAttribute('aria-label'),
      ).not.toBe(selected)
      await page.keyboard.press('PageDown')
      await page.keyboard.press('Home')
      await noOverflow(page)
      await axe(page)
      await page.keyboard.press('Enter')
      await expect(
        page.getByRole('button', {
          name: 'Abrir calendário: Prazo',
          exact: true,
        }),
      ).toBeFocused()
      await expect(page.getByLabel('Prazo', { exact: true })).not.toHaveValue(
        '',
      )
      await page.keyboard.press('Escape')
      await mkdir('docs/screenshots', { recursive: true })
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-9a-tarefas-${theme}-${width}.png`,
        ),
        fullPage: true,
      })
      await page.goto('/perfil')
      await page
        .getByRole('heading', {
          name: 'Personalize seu espaço',
          exact: true,
          level: 1,
        })
        .waitFor()
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-9a-perfil-${theme}-${width}.png`,
        ),
        fullPage: true,
      })
      const md = await importDialog(page)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%'
      })
      await noOverflow(page)
      await axe(page)
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-9a-markdown-${theme}-${width}.png`,
        ),
        fullPage: true,
      })
      await md.getByRole('button', { name: 'Cancelar', exact: true }).click()
    }
  })
}
