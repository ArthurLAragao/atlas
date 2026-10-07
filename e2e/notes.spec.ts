import { evidencePath } from './evidence.js'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import {
  collections,
  emptySnapshot,
  snapshotSchema,
  type Note,
  type Snapshot,
} from '../src/data/models.js'

const titleField = (page: Page) =>
  page.getByLabel('Título da nota', { exact: true })
const contentField = (page: Page) =>
  page.getByLabel('Conteúdo Markdown', { exact: true })
const preview = (page: Page) =>
  page.getByRole('article', { name: 'Pré-visualização da nota', exact: true })

test.use({ actionTimeout: 15_000 })

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function readData(page: Page): Promise<Snapshot> {
  const data = await page.evaluate(
    (names) =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const request = indexedDB.open('atlas-local')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(names, 'readonly')
          const result: Record<string, unknown[]> = {}
          for (const name of names) {
            const read = transaction.objectStore(name).getAll()
            read.onsuccess = () => {
              result[name] = read.result as unknown[]
            }
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            database.close()
            resolve(result)
          }
        }
      }),
    [...collections],
  )
  return snapshotSchema.parse(data)
}

async function openData(page: Page) {
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function importFile(dialog: Locator, name: string, text: string) {
  await dialog
    .getByLabel('Arquivo para importar', { exact: true })
    .setInputFiles({
      name,
      mimeType: name.endsWith('.json') ? 'application/json' : 'text/markdown',
      buffer: Buffer.from(text),
    })
  await dialog
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(dialog.locator('.import-preview')).not.toBeVisible()
}

async function createNote(page: Page, title: string, template = 'blank') {
  await page.goto('/notas')
  await expect(
    page.getByRole('heading', { name: 'Notas', level: 1, exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Nova nota', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova nota', exact: true })
  await expect(
    dialog.getByLabel('Título da nota', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Título da nota', { exact: true }).fill(title)
  await dialog
    .getByRole('combobox', { name: 'Modelo', exact: true })
    .selectOption(template)
  await dialog.getByRole('button', { name: 'Criar nota', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/notas\?note=[^&]+&edit=1$/)
  await expect(contentField(page)).toBeFocused()
  return (await readData(page)).notes.find((note) => note.title === title)!
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Salvar nota', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Salvar nota', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText('Nota salva.', { exact: true }).first(),
  ).toBeVisible()
}

async function openPalette(page: Page, query: string) {
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', {
    name: 'Captura rápida',
    exact: true,
  })
  const input = dialog.getByLabel('Capturar ou navegar', { exact: true })
  await expect(input).toBeFocused()
  await input.fill(query)
  return { dialog, input }
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    result.violations,
    JSON.stringify(
      result.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
    ),
  ).toEqual([])
}

test('cria os quatro templates, edita Markdown, preserva rascunho e alterna prévia sem perder texto', async ({
  page,
}) => {
  const errors = watchErrors(page)
  for (const [template, heading] of [
    ['class', 'Disciplina e tema'],
    ['book', 'Livro e autoria'],
    ['project', 'Problema'],
    ['review', 'O que avançou'],
  ] as const) {
    const note = await createNote(page, `Modelo ${template}`, template)
    await expect(contentField(page)).toHaveValue(note.content)
    expect(note.content).toContain(`## ${heading}`)
    await page
      .getByRole('button', { name: 'Pré-visualizar', exact: true })
      .click()
    await expect(
      preview(page).getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Pré-visualizar', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
  }
  const text =
    '# Minha revisão\n\nIdeias sobre **algoritmos** e árvores.\n\n- [x] Ler\n- [ ] Aplicar\n\n> Uma conexão por vez.\n'
  await contentField(page).fill(text)
  await page
    .getByLabel('Tags da nota', { exact: true })
    .fill('faculdade, estruturas')
  await page.reload()
  await expect(contentField(page)).toHaveValue(text)
  await expect(page.getByLabel('Tags da nota', { exact: true })).toHaveValue(
    'faculdade, estruturas',
  )
  await contentField(page).press('Control+s')
  await expect(
    page.getByRole('button', { name: 'Salvar nota', exact: true }),
  ).toBeDisabled()
  const saved = (await readData(page)).notes.find(
    (note) => note.title === 'Modelo review',
  )!
  expect(saved).toMatchObject({
    content: text,
    tags: ['faculdade', 'estruturas'],
    isExample: false,
  })
  await page
    .getByRole('button', { name: 'Pré-visualizar', exact: true })
    .click()
  await expect(
    preview(page).getByRole('heading', { name: 'Minha revisão', exact: true }),
  ).toBeVisible()
  await expect(preview(page).locator('strong')).toHaveText('algoritmos')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await axe(page)
  expect(errors).toEqual([])
})

test('autocomplete por teclado conecta duas notas, mostra backlink e preserva a conexão ao renomear', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const target = await createNote(page, 'Fundamentos de Redes')
  await contentField(page).fill('Camadas e protocolos.')
  await save(page)
  const source = await createNote(page, 'Aula de infraestrutura')
  await contentField(page).fill('Aprofundar ')
  await contentField(page).press('End')
  await page.keyboard.insertText('[[Fundamentos')
  const suggestions = page.getByRole('listbox', {
    name: 'Sugestões de links',
    exact: true,
  })
  await expect(
    suggestions.getByRole('option', {
      name: 'Fundamentos de Redes',
      exact: true,
    }),
  ).toBeVisible()
  await axe(page)
  await contentField(page).press('Enter')
  await expect(contentField(page)).toHaveValue(
    'Aprofundar [[Fundamentos de Redes]]',
  )
  await expect(contentField(page)).toBeFocused()
  await expect(suggestions).not.toBeVisible()
  await save(page)
  expect(
    (await readData(page)).notes.find((note) => note.id === source.id)?.content,
  ).toBe('Aprofundar [[Fundamentos de Redes]]')
  await page
    .getByRole('button', { name: 'Pré-visualizar', exact: true })
    .click()
  await preview(page)
    .getByRole('link', { name: 'Fundamentos de Redes', exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`note=${target.id}`))
  const backlinks = page.getByRole('region', {
    name: 'Notas que apontam para cá',
    exact: true,
  })
  await expect(
    backlinks.getByRole('link', {
      name: 'Aula de infraestrutura',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await titleField(page).fill('Redes e protocolos')
  await save(page)
  await expect(
    page.getByRole('heading', {
      name: 'Redes e protocolos',
      level: 1,
      exact: true,
    }),
  ).toBeVisible()
  await backlinks
    .getByRole('link', { name: 'Aula de infraestrutura', exact: true })
    .click()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(contentField(page)).toHaveValue(
    'Aprofundar [[Redes e protocolos]]',
  )
  expect(
    (await readData(page)).notes.find((note) => note.id === source.id)?.content,
  ).toBe('Aprofundar [[Redes e protocolos]]')
  await page.reload()
  await expect(
    preview(page).getByRole('link', {
      name: 'Redes e protocolos',
      exact: true,
    }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('busca conteúdo e tags imediatamente, busca global encontra registros e nota: abre a edição', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const note = await createNote(page, 'Arquitetura de computadores')
  await contentField(page).fill(
    'A microarquitetura controla a execução das instruções.',
  )
  await page.getByLabel('Tags da nota', { exact: true }).fill('UNIVERSIDADE EXEMPLO, revisão')
  await save(page)
  await page.getByRole('link', { name: 'Voltar às notas', exact: true }).click()
  const list = page.getByRole('list', {
    name: 'Notas encontradas',
    exact: true,
  })
  await page
    .getByLabel('Buscar notas', { exact: true })
    .fill('MICROARQUITETURA')
  await expect(list.getByRole('link')).toHaveCount(1)
  await expect(list).toContainText(note.title)
  await page.getByLabel('Buscar notas', { exact: true }).fill('#revisao')
  await expect(list.getByRole('link')).toHaveCount(1)
  const before = await readData(page)
  const global = await openPalette(page, 'buscar microarquitetura')
  const result = global.dialog
    .getByRole('option')
    .filter({ hasText: note.title })
  await expect(result).toHaveCount(1)
  await expect(
    global.dialog.getByRole('option').filter({ hasText: 'Criar tarefa' }),
  ).toHaveCount(0)
  await global.input.press('Enter')
  await expect(page).toHaveURL(new RegExp(`note=${note.id}`))
  await expect(
    page.getByRole('heading', { name: note.title, exact: true, level: 1 }),
  ).toBeVisible()
  expect(await readData(page)).toEqual(before)
  const capture = await openPalette(page, 'nota: Ideia capturada #pessoal')
  await capture.input.press('Enter')
  await expect(capture.dialog).not.toBeVisible()
  await expect(page).toHaveURL(/&edit=1$/)
  await expect(contentField(page)).toBeFocused()
  await expect(titleField(page)).toHaveValue('Ideia capturada')
  await expect(page.getByLabel('Tags da nota', { exact: true })).toHaveValue(
    'pessoal',
  )
  await contentField(page).fill('Anotada em poucos segundos.')
  await save(page)
  expect((await readData(page)).notes).toHaveLength(before.notes.length + 1)
  expect((await readData(page)).tasks).toEqual(before.tasks)
  expect(errors).toEqual([])
})

test('arquivar e excluir oferecem desfazer persistente após recarregar, incluindo os vínculos', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await createNote(page, 'Destino para recuperação')
  await contentField(page).fill('Recebe as conexões de conhecimento.')
  await save(page)
  const note = await createNote(page, 'Conhecimento para recuperar')
  await contentField(page).fill(
    'Texto persistente com #conteúdo e [[Destino para recuperação]].',
  )
  await save(page)
  const before = (await readData(page)).notes.find(
    (item) => item.id === note.id,
  )!
  await page.getByRole('button', { name: 'Arquivar nota', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Mostrar notas', exact: true }),
  ).toHaveValue('archived')
  await expect(
    page.getByRole('list', { name: 'Notas encontradas' }),
  ).toContainText(note.title)
  expect(
    (await readData(page)).notes.find((item) => item.id === note.id)
      ?.archivedAt,
  ).toBeTruthy()
  await page.reload()
  await page.getByText('Última ação em notas', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Desfazer última ação em notas', exact: true })
    .click()
  await expect(
    page.getByText('Ação desfeita. Nota recuperada.', { exact: true }),
  ).toBeVisible()
  expect(
    (await readData(page)).notes.find((item) => item.id === note.id),
  ).toEqual(before)
  await page
    .getByRole('combobox', { name: 'Mostrar notas', exact: true })
    .selectOption('active')
  await page
    .getByRole('list', { name: 'Notas encontradas' })
    .getByRole('link')
    .filter({ hasText: note.title })
    .click()
  await page.getByRole('button', { name: 'Excluir nota', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Notas', exact: true, level: 1 }),
  ).toBeVisible()
  expect(
    (await readData(page)).notes.find((item) => item.id === note.id),
  ).toBeUndefined()
  await page.reload()
  await page.getByText('Última ação em notas', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Desfazer última ação em notas', exact: true })
    .click()
  expect(
    (await readData(page)).notes.find((item) => item.id === note.id),
  ).toEqual(before)
  await expect(
    page.getByRole('list', { name: 'Notas encontradas' }),
  ).toContainText(note.title)
  const recovered = page.getByRole('link', {
    name: `Abrir nota recuperada: ${note.title}`,
    exact: true,
  })
  await expect(recovered).toBeFocused()
  await recovered.press('Enter')
  await expect(contentField(page)).toBeFocused()
  await expect(contentField(page)).toHaveValue(before.content)
  await axe(page)
  expect(errors).toEqual([])
})

test('exporta uma nota Markdown com tags e links e reimporta com fidelidade textual', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const target = await createNote(page, 'Destino Markdown')
  await contentField(page).fill('O destino é compartilhado por links.')
  await save(page)
  const source = await createNote(page, 'Origem Markdown')
  const text =
    '# Corpo da nota\n\n[[Destino Markdown]] e **acentuação**.\n\n```ts\nconst link = "[[literal]]"\n```\n'
  await contentField(page).fill(text)
  await page
    .getByLabel('Tags da nota', { exact: true })
    .fill('faculdade, exportação')
  await save(page)
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar Markdown', exact: true })
    .click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('Origem Markdown.md')
  const markdown = await readFile((await download.path())!, 'utf8')
  expect(markdown).toContain('title: "Origem Markdown"')
  expect(markdown).toContain('tags: ["faculdade","exportação"]')
  expect(markdown).toContain('[[Destino Markdown]]')
  expect(markdown).toContain(text)
  await page.getByRole('button', { name: 'Excluir nota', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  const dialog = await openData(page)
  await importFile(dialog, download.suggestedFilename(), markdown)
  const data = await readData(page)
  const imported = data.notes.find((note) => note.title === source.title)!
  expect(imported.id).not.toBe(source.id)
  expect(imported).toMatchObject({
    content: text,
    tags: ['faculdade', 'exportação'],
    archivedAt: null,
    isExample: false,
  })
  await page.keyboard.press('Escape')
  await page.goto(`/notas?note=${imported.id}`)
  await preview(page)
    .getByRole('link', { name: target.title, exact: true })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'Notas que apontam para cá', exact: true })
      .getByRole('link', { name: source.title, exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('edição só do conteúdo e exportação preservam tags importadas com vírgula e cerquilha', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/notas')
  const timestamp = new Date().toISOString()
  const imported: Note = {
    id: 'note-literal-tags',
    title: 'Tags importadas sem perda',
    content: 'Conteúdo inicial.',
    tags: ['cloud, aws', '#literal'],
    links: [],
    isExample: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const panel = await openData(page)
  await importFile(
    panel,
    'literal-tags.json',
    JSON.stringify({
      format: 'atlas',
      schemaVersion: 1,
      exportedAt: timestamp,
      data: { ...emptySnapshot(), notes: [imported] },
    }),
  )
  await page.keyboard.press('Escape')
  await page.goto(`/notas?note=${imported.id}&edit=1`)
  const text =
    'Só o conteúdo mudou; as tags existentes continuam sendo dados exatos.'
  await contentField(page).fill(text)
  await save(page)
  expect(
    (await readData(page)).notes.find((note) => note.id === imported.id),
  ).toMatchObject({ content: text, tags: imported.tags })
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Exportar Markdown', exact: true })
    .click()
  const download = await downloadPromise
  const markdown = await readFile((await download.path())!, 'utf8')
  expect(markdown).toContain('tags: ["cloud, aws","#literal"]')
  await page.getByRole('button', { name: 'Excluir nota', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  const transfer = await openData(page)
  await importFile(transfer, download.suggestedFilename(), markdown)
  expect(
    (await readData(page)).notes.find((note) => note.title === imported.title),
  ).toMatchObject({ content: text, tags: imported.tags })
  expect(errors).toEqual([])
})

for (const format of ['json', 'md'] as const) {
  test(`backup ${format} restaura notas ligadas e arquivadas sem perder nenhum campo`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    const errors = watchErrors(page)
    try {
      await page.goto('/notas')
      const initialPanel = await openData(page)
      await initialPanel
        .getByRole('button', { name: 'Remover exemplos (20)', exact: true })
        .click()
      await expect(
        initialPanel.getByText('0 registros salvos localmente', {
          exact: true,
        }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await createNote(page, 'Destino do backup')
      await contentField(page).fill('Conteúdo da nota de destino.')
      await save(page)
      await createNote(page, 'Origem do backup')
      await contentField(page).fill(
        'Ligação [[Destino do backup]] e acentuação.\n',
      )
      await page
        .getByLabel('Tags da nota', { exact: true })
        .fill('backup, revisão')
      await save(page)
      await page
        .getByRole('button', { name: 'Arquivar nota', exact: true })
        .click()
      const before = await readData(page)
      const dialog = await openData(page)
      const downloadPromise = page.waitForEvent('download')
      await dialog
        .getByRole('button', {
          name: format === 'json' ? 'Exportar JSON' : 'Exportar Markdown',
          exact: true,
        })
        .click()
      const download = await downloadPromise
      const text = await readFile((await download.path())!, 'utf8')
      // The context above is explicitly disposable. These writes never touch the user's browser profile.
      await page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('atlas-local')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const database = request.result
              const names = Array.from(database.objectStoreNames)
              const transaction = database.transaction(names, 'readwrite')
              for (const name of names) transaction.objectStore(name).clear()
              transaction.onerror = () => {
                database.close()
                reject(transaction.error)
              }
              transaction.oncomplete = () => {
                database.close()
                resolve()
              }
            }
          }),
      )
      expect(
        Object.values(await readData(page)).every((items) =>
          Array.isArray(items) ? items.length === 0 : items === null,
        ),
      ).toBe(true)
      await importFile(dialog, `ligadas.${format}`, text)
      expect(await readData(page)).toEqual(before)
      await page.reload()
      expect(await readData(page)).toEqual(before)
      await page
        .getByRole('combobox', { name: 'Mostrar notas', exact: true })
        .selectOption('active')
      await page
        .getByRole('list', { name: 'Notas encontradas' })
        .getByRole('link')
        .filter({ hasText: 'Destino do backup' })
        .click()
      await expect(
        page.getByRole('region', { name: 'Notas que apontam para cá' }),
      ).toContainText('Origem do backup')
      await expect(
        page.getByRole('region', { name: 'Notas que apontam para cá' }),
      ).toContainText('Arquivada')
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  })
}

test('textos longos em 375, 768 e 1280 px, temas e texto a 200%, sem HTML ativo ou imagens remotas', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  const remoteRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://example.com/atlas-test'))
      remoteRequests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createNote(page, 'Conhecimento com espaço para pensar')
  const paragraph =
    'A organização do conhecimento começa com uma anotação simples. Conectar assuntos ajuda a reconhecer padrões, revisar fundamentos e encontrar uma ideia quando ela faz falta.'
  const text = `# Notas de sistemas\n\n${Array.from({ length: 120 }, (_, index) => `## Ideia ${index + 1}\n\n${paragraph}\n\n- Fundamentos\n- Prática\n`).join('\n')}\n\n| Conceito | Explicação |\n| --- | --- |\n| Caminho longo | ${'abcdefghij'.repeat(80)} |\n\n\`\`\`ts\n${'const conhecimento = '.repeat(60)}\n\`\`\`\n\n<img src="https://example.com/atlas-test-html" onerror="window.atlasUnsafe = true">\n\n![Imagem de teste](https://example.com/atlas-test-markdown)\n\n[Link inseguro](javascript:alert(1))\n`
  await contentField(page).fill(text)
  await save(page)
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Editar', exact: true }).click()
      await expect(contentField(page)).toHaveValue(text)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expect(contentField(page)).toHaveCSS('backdrop-filter', 'none')
      await axe(page)
      await page
        .getByRole('button', { name: 'Pré-visualizar', exact: true })
        .click()
      await expect(
        preview(page).getByRole('heading', { name: 'Ideia 120', exact: true }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expect(preview(page)).toHaveCSS('backdrop-filter', 'none')
      await expect(preview(page).locator('img, script, iframe')).toHaveCount(0)
      await expect(
        preview(page).getByRole('link', { name: 'Link inseguro', exact: true }),
      ).toHaveCount(0)
      await axe(page)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-6-preview-${width}.png`),
    })
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-6-editor-${width}.png`),
    })
    await contentField(page).scrollIntoViewIfNeeded()
    await contentField(page).evaluate((element) => {
      element.scrollTop = 0
    })
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-6-escrita-${width}.png`),
    })
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(contentField(page)).toHaveValue(text)
    await axe(page)
    await page
      .getByRole('button', { name: 'Pré-visualizar', exact: true })
      .click()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await axe(page)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = ''
    })
  }
  expect(remoteRequests).toEqual([])
  expect(errors).toEqual([])
})

test('lista de 210 notas é virtualizada e permite chegar às extremidades pelo teclado', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/notas')
  const current = await readData(page)
  const timestamp = new Date().toISOString()
  const notes: Note[] = Array.from({ length: 210 }, (_, index) => ({
    id: `virtual-note-${index}`,
    title: `Nota virtual ${String(index + 1).padStart(3, '0')}`,
    content: `Anotação ${index + 1} para percorrer com teclado.`,
    tags: ['virtual'],
    links: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    isExample: false,
  }))
  const dialog = await openData(page)
  await importFile(
    dialog,
    'virtual.json',
    JSON.stringify({
      format: 'atlas',
      schemaVersion: 1,
      exportedAt: timestamp,
      data: { ...current, notes: [...current.notes, ...notes] },
    }),
  )
  await page.keyboard.press('Escape')
  await page.getByLabel('Buscar notas', { exact: true }).fill('#virtual')
  const list = page.getByRole('list', {
    name: 'Notas encontradas',
    exact: true,
  })
  await expect(
    page.getByText('210 notas encontradas', { exact: true }),
  ).toBeVisible()
  expect(await list.getByRole('listitem').count()).toBeLessThan(210)
  const first = list.getByRole('link').filter({ hasText: 'Nota virtual 001' })
  await first.focus()
  await page.keyboard.press('End')
  const last = list.getByRole('link').filter({ hasText: 'Nota virtual 210' })
  await expect(last).toBeFocused()
  await expect(
    last.locator('xpath=ancestor::*[@role="listitem"]'),
  ).toHaveAttribute('aria-posinset', '210')
  await page.keyboard.press('ArrowUp')
  await expect(
    list.getByRole('link').filter({ hasText: 'Nota virtual 209' }),
  ).toBeFocused()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(contentField(page)).toHaveValue(notes[0]!.content)
  await expect(contentField(page)).toBeFocused()
  expect(errors).toEqual([])
})
