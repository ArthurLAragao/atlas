import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  collections,
  snapshotSchema,
  type Collection,
  type Snapshot,
} from '../src/data/models.js'

async function snapshot(page: Page): Promise<Record<Collection, unknown[]>> {
  return page.evaluate(
    (names) =>
      new Promise<Record<Collection, unknown[]>>((resolve, reject) => {
        const request = indexedDB.open('atlas-local')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction(names, 'readonly')
          const result = {} as Record<Collection, unknown[]>
          for (const name of names) {
            const read = transaction.objectStore(name).getAll()
            read.onsuccess = () => {
              result[name] = read.result as unknown[]
            }
          }
          transaction.onerror = () => {
            db.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            db.close()
            resolve(result)
          }
        }
      }),
    [...collections],
  )
}

function personalFixture(data: Snapshot): Snapshot {
  for (const name of collections)
    for (const item of data[name]) item.isExample = false
  data.tasks[0]!.subtasks = [
    { id: 'sub-1', title: 'Árvores & grafos', done: true },
  ]
  data.tasks[0]!.repeat = { unit: 'week', interval: 2 }
  data.tasks[0]!.focusMinutes = 27
  data.notes[0]!.content =
    '# Aula\n\n[[Resumo]] · acentuação e **Markdown**\n<!-- ATLAS_BACKUP_V1 -->'
  data.habitLogs.push({
    ...data.habitLogs[0]!,
    id: 'rest-day',
    date: '2026-09-29',
    value: 0,
    rest: true,
  })
  return data
}

for (const format of ['json', 'md'] as const) {
  test(`ida e volta ${format} no IndexedDB real após limpar todas as tabelas`, async ({
    browser,
    baseURL,
  }) => {
    // Explicit nonpersistent, disposable context. No user profile, cookies, origin
    // storage, existing tabs or saved storageState can enter this test.
    const isolatedContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    })
    const page = await isolatedContext.newPage()
    try {
      await page.goto('/')
      await page.getByRole('button', { name: 'Seus dados' }).click()
      const panel = page.getByRole('dialog', { name: 'Seus dados' })
      await expect(
        panel.getByText('20 registros salvos localmente'),
      ).toBeVisible()
      const fixture = personalFixture(
        snapshotSchema.parse(await snapshot(page)),
      )
      await panel.getByRole('button', { name: 'Remover exemplos (20)' }).click()
      await panel.getByLabel('Arquivo para importar').setInputFiles({
        name: 'personal.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            format: 'atlas',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            data: fixture,
          }),
        ),
      })
      await panel.getByRole('button', { name: 'Confirmar importação' }).click()
      await expect(
        panel.getByText('21 registros salvos localmente'),
      ).toBeVisible()
      const before = await snapshot(page)
      const downloadPromise = page.waitForEvent('download')
      await panel
        .getByRole('button', {
          name: format === 'json' ? 'Exportar JSON' : 'Exportar Markdown',
          exact: true,
        })
        .click()
      const download = await downloadPromise
      const backup = await readFile((await download.path())!, 'utf8')
      await page.evaluate(
        () =>
          new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('atlas-local')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const db = request.result
              const names = Array.from(db.objectStoreNames)
              const transaction = db.transaction(names, 'readwrite')
              for (const name of names) transaction.objectStore(name).clear()
              transaction.onerror = () => {
                db.close()
                reject(transaction.error)
              }
              transaction.oncomplete = () => {
                db.close()
                resolve()
              }
            }
          }),
      )
      const empty = await snapshot(page)
      expect(
        Object.values(empty).every((items) =>
          Array.isArray(items) ? items.length === 0 : items === null,
        ),
      ).toBe(true)
      // Native IndexedDB writes do not notify Dexie's liveQuery; import re-reads the transaction.
      await panel.getByLabel('Arquivo para importar').setInputFiles({
        name: `backup.${format}`,
        mimeType: format === 'json' ? 'application/json' : 'text/markdown',
        buffer: Buffer.from(backup),
      })
      await panel.getByRole('button', { name: 'Confirmar importação' }).click()
      await expect(
        panel.getByText(
          '21 registros importados. 0 registros existentes preservados.',
        ),
      ).toBeVisible()
      expect(await snapshot(page)).toEqual(before)
      await page.reload()
      expect(await snapshot(page)).toEqual(before)
      await page.getByRole('button', { name: 'Seus dados' }).click()
      await expect(
        panel.getByText('21 registros salvos localmente'),
      ).toBeVisible()
    } finally {
      await isolatedContext.close()
    }
  })
}
