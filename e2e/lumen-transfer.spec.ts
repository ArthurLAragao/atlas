import { test, expect, type Page, type Locator } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
// Independent test-vector framing, matching transfer-v1. No app code executes in Node.
function comparisonBytes(title: string, tags: string[], markdown: string) {
  const count = Buffer.alloc(4)
  count.writeUInt32BE(tags.length)
  const frame = (value: string) => {
    const bytes = Buffer.from(value, 'utf8')
    const length = Buffer.alloc(4)
    length.writeUInt32BE(bytes.length)
    return Buffer.concat([length, bytes])
  }
  return Buffer.concat([
    Buffer.from('LUMEN-ATLAS-COMPARE'),
    Buffer.from([0, 1]),
    frame(title),
    count,
    ...tags.map(frame),
    frame(markdown),
  ])
}

const origin = 'http://127.0.0.1:4189'
const dbName = 'atlas-lumen-test-stage9d-fictional'
const id = 'lumen_' + 'a'.repeat(32)
const fixture = async () =>
  JSON.parse(
    await readFile(
      new URL(
        '../src/lib/lumen-atlas/fixtures/example.lumen-atlas.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>
async function packet(
  text?: string,
  baseline: string | null = null,
  alternate = false,
) {
  const data = await fixture()
  if (text) data.markdown = (data.markdown as string) + '\n' + text
  if (alternate) {
    const before = data.title as string
    data.title = 'Other fictional transfer'
    data.markdown = (data.markdown as string).replaceAll(
      before,
      data.title as string,
    )
    data.integration_id = 'lumen_' + 'b'.repeat(32)
  }
  data.baseline_sha256 = baseline
  data.source_sha256 = createHash('sha256')
    .update(data.markdown as string)
    .digest('hex')
  data.comparison_sha256 = createHash('sha256')
    .update(
      comparisonBytes(
        data.title as string,
        data.tags as string[],
        data.markdown as string,
      ),
    )
    .digest('hex')
  return data
}
async function readTestData(page: Page) {
  expect(new URL(page.url()).origin).toBe(origin)
  return page.evaluate(
    async ({ name }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const tables = Array.from(db.objectStoreNames)
      const data: Record<string, unknown[]> = {}
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(tables, 'readonly')
        for (const table of tables) {
          const request = tx.objectStore(table).getAll()
          request.onsuccess = () => {
            data[table] = request.result as unknown[]
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
      return data
    },
    { name: dbName },
  )
}
async function mutateTest(page: Page, kind: 'local' | 'capacity') {
  expect(new URL(page.url()).origin).toBe(origin)
  await page.evaluate(
    async ({ name, kind, id }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open(name)
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['notes', 'meta'], 'readwrite')
        const table = tx.objectStore(kind === 'local' ? 'notes' : 'meta')
        const r = table.get(kind === 'local' ? id : 'lumenTransferHistory.v1')
        r.onsuccess = () => {
          if (kind === 'local')
            table.put({
              ...r.result,
              content: 'Local fictional edit',
              updatedAt: new Date().toISOString(),
            })
          else
            table.put({
              key: 'lumenTransferHistory.v1',
              value: {
                version: 1,
                operations: Array.from({ length: 100 }, () => ({
                  ...r.result.value.operations[0],
                  operation_id: crypto.randomUUID(),
                })),
              },
            })
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    { name: dbName, kind, id },
  )
}
async function open(page: Page, pkg: Record<string, unknown>) {
  await page
    .getByRole('button', { name: 'Importar do Lumen', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Importar do Lumen',
    exact: true,
  })
  await expect(dialog).toContainText('AMBIENTE FICTÍCIO')
  await dialog
    .getByLabel('Selecionar pacote .lumen-atlas.json', { exact: true })
    .setInputFiles({
      name: 'fictional.lumen-atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(pkg)),
    })
  await expect(
    dialog.getByRole('heading', { name: 'Plano da importação' }),
  ).toBeVisible()
  return dialog
}
async function confirm(dialog: Locator) {
  await dialog
    .getByRole('button', { name: 'Revisar importação', exact: true })
    .click()
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await dialog
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
}
test.beforeEach(async ({ page }) => {
  // Ephemeral Playwright context, no persistent profile or storageState.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.origin === origin || url.protocol === 'data:'
      ? route.continue()
      : route.abort()
  })
  await page.goto('/notas')
  await expect(
    page.getByRole('heading', { name: 'Notas', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Importar do Lumen', exact: true }),
  ).toBeEnabled()
})
test('create, identical, update, protected recovery and keyboard confirmation in isolated real browser', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const initial = await readTestData(page)
  const pkg = await packet()
  let dialog = await open(page, pkg)
  await expect(
    dialog.getByLabel('Markdown proposto (inclui YAML)'),
  ).toHaveAttribute('readonly', '')
  await page.screenshot({ path: info.outputPath('atlas-plan.png') })
  await dialog
    .getByRole('button', { name: 'Revisar importação', exact: true })
    .click()
  await expect(
    dialog.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await page.screenshot({ path: info.outputPath('atlas-confirmation.png') })
  await dialog
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(dialog.getByRole('status')).toContainText('Nota criada')
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  const created = await readTestData(page)
  dialog = await open(page, pkg)
  await confirm(dialog)
  await expect(dialog.getByRole('status')).toContainText('idêntica')
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  expect(await readTestData(page)).toEqual(created)
  dialog = await open(
    page,
    await packet('Second fictional revision', pkg.comparison_sha256 as string),
  )
  await expect(dialog).toContainText('Atualização elegível')
  await expect(
    dialog.getByRole('textbox', { name: 'Markdown atual', exact: true }),
  ).toHaveValue(pkg.markdown as string)
  await confirm(dialog)
  await expect(dialog.getByRole('status')).toContainText('Nota atualizada')
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Histórico Lumen', exact: true })
    .click()
  dialog = page.getByRole('dialog', { name: 'Histórico Lumen', exact: true })
  await expect(dialog).toContainText('não incluído nos backups')
  await dialog
    .getByRole('button', { name: 'Ver versão recuperável', exact: true })
    .nth(1)
    .click()
  await expect(
    dialog.getByRole('textbox', {
      name: 'Markdown proposto (inclui YAML)',
      exact: true,
    }),
  ).toHaveValue(pkg.markdown as string)
  await dialog
    .getByRole('button', { name: 'Revisar restauração', exact: true })
    .click()
  await page.setViewportSize({ width: 390, height: 844 })
  await dialog
    .getByRole('button', { name: 'Confirmar restauração', exact: true })
    .scrollIntoViewIfNeeded()
  const box = await dialog
    .getByRole('button', { name: 'Confirmar restauração', exact: true })
    .boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: info.outputPath('atlas-recovery-mobile.png') })
  await dialog
    .getByRole('button', { name: 'Confirmar restauração', exact: true })
    .click()
  await expect(dialog.getByRole('status')).toContainText(
    'Versão anterior restaurada',
  )
  const final = await readTestData(page)
  for (const table of Object.keys(initial).filter(
    (t) => t !== 'notes' && t !== 'meta',
  ))
    expect(final[table]).toEqual(initial[table])
  expect(
    (final.notes as { id: string; content: string }[]).find((n) => n.id === id)
      ?.content,
  ).toBe(pkg.markdown)
  expect(errors).toEqual([])
})
test('cancellation, invalid package, drafts, stale confirmation, local conflict and recovery limit', async ({
  page,
}) => {
  const pkg = await packet()
  let dialog = await open(page, pkg)
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('cancelada')
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  expect(
    (await readTestData(page)).notes?.some(
      (n) => (n as { id: string }).id === id,
    ),
  ).toBe(false)
  await page
    .getByRole('button', { name: 'Importar do Lumen', exact: true })
    .click()
  dialog = page.getByRole('dialog', { name: 'Importar do Lumen', exact: true })
  await dialog
    .getByLabel('Selecionar pacote .lumen-atlas.json')
    .setInputFiles({
      name: 'bad.lumen-atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"fictional":"invalid"}'),
    })
  await expect(dialog.getByRole('alert')).toContainText('inválido')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  dialog = await open(page, pkg)
  await confirm(dialog)
  await expect(dialog.getByRole('status')).toContainText('Nota criada')
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  const update = await packet(
    'Another revision',
    pkg.comparison_sha256 as string,
  )
  await page.evaluate(
    (id) =>
      localStorage.setItem(
        'atlas.note-drafts.v1',
        JSON.stringify({
          [id]: {
            title: 'Draft',
            content: 'Fictional pending edit',
            tags: '',
            basedOn: 'earlier',
          },
        }),
      ),
    id,
  )
  dialog = await open(page, update)
  await expect(dialog).toContainText('Há edição pendente')
  expect(
    await page.evaluate(() => localStorage.getItem('atlas.note-drafts.v1')),
  ).toContain('Fictional pending')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  // Test fixture cleanup only, on the dedicated isolated origin.
  await page.evaluate(() => localStorage.removeItem('atlas.note-drafts.v1'))
  dialog = await open(page, update)
  await dialog
    .getByRole('button', { name: 'Revisar importação', exact: true })
    .click()
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'atlas.note-drafts.v1' }),
    ),
  )
  await expect(dialog.getByRole('alert')).toContainText('obsoleta')
  await expect(
    dialog.getByRole('button', { name: 'Confirmar importação', exact: true }),
  ).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  await mutateTest(page, 'local')
  dialog = await open(page, update)
  await expect(dialog).toContainText('Conflito com a versão local')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Fechar resultado', exact: true })
    .click()
  await mutateTest(page, 'capacity')
  dialog = await open(page, await packet('Different note', null, true))
  await expect(dialog).toContainText('Limite de recuperação atingido')
  await expect(
    dialog.getByRole('button', { name: 'Confirmar importação', exact: true }),
  ).toHaveCount(0)
})
