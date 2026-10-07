import { test, expect, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { AxeBuilder } from '@axe-core/playwright'
import {
  collections,
  snapshotSchema,
  type Snapshot,
} from '../src/data/models.js'
import { buildSeed } from '../src/data/seed.js'
import { defaultProfile } from '../src/data/profile-models.js'
import { initialReview } from '../src/lib/sm2.js'
import { experienceEvent } from '../src/lib/experience.js'

test.use({ actionTimeout: 15_000 })

async function snapshot(page: Page): Promise<Snapshot> {
  await page.locator('main h1').waitFor()
  return snapshotSchema.parse(
    await page.evaluate(
      (names) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const open = indexedDB.open('atlas-local')
          open.onerror = () => reject(open.error)
          open.onsuccess = () => {
            const db = open.result
            const tx = db.transaction([...names, 'meta'], 'readonly')
            const result: Record<string, unknown> = {}
            for (const name of names) {
              const request = tx.objectStore(name).getAll()
              request.onsuccess = () => {
                result[name] = request.result as unknown[]
              }
            }
            for (const key of ['profile', 'activity', 'experience']) {
              const request = tx.objectStore('meta').get(key)
              request.onsuccess = () => {
                result[key] =
                  (request.result as { value: unknown } | undefined)?.value ??
                  (key === 'profile' ? null : [])
              }
            }
            tx.oncomplete = () => {
              db.close()
              resolve(result)
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }),
      [...collections],
    ),
  )
}

test('duas abas: tarefa e hábito recusam edição antiga e mantêm o rascunho recuperável', async ({
  page,
  context,
}) => {
  await page.goto('/tarefas')
  const original = (await snapshot(page)).tasks[0]!
  const other = await context.newPage()
  await other.goto('/tarefas')
  for (const tab of [page, other])
    await tab
      .locator(`[data-task-id="${original.id}"]`)
      .getByRole('button', { name: `Editar ${original.title}`, exact: true })
      .click()
  await page
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Versão mais recente')
  await other
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Rascunho preservado')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar tarefa', exact: true })
    .click()
  await other
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar tarefa', exact: true })
    .click()
  await expect(
    other.getByRole('dialog').getByText(/mudou em outra aba/),
  ).toBeVisible()
  await expect(
    other.getByRole('dialog').getByLabel('Nome', { exact: true }),
  ).toHaveValue('Rascunho preservado')
  expect(
    (await snapshot(other)).tasks.find((item) => item.id === original.id)
      ?.title,
  ).toBe('Versão mais recente')
  expect(
    (
      await new AxeBuilder({ page: other })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await other.keyboard.press('Escape')
  await page.goto('/habitos')
  await other.goto('/habitos')
  for (const tab of [page, other]) {
    await tab
      .getByRole('button', { name: 'Ver histórico de Academia', exact: true })
      .click()
    await tab
      .getByRole('button', { name: 'Editar hábito', exact: true })
      .click()
  }
  await page
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Academia atualizada')
  await other
    .getByRole('dialog')
    .getByLabel('Nome', { exact: true })
    .fill('Meu rascunho de hábito')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar hábito', exact: true })
    .click()
  await other
    .getByRole('dialog')
    .getByRole('button', { name: 'Salvar hábito', exact: true })
    .click()
  await expect(
    other.getByRole('dialog').getByText(/mudou em outra aba/),
  ).toBeVisible()
  await expect(
    other.getByRole('dialog').getByLabel('Nome', { exact: true }),
  ).toHaveValue('Meu rascunho de hábito')
  expect(
    (await snapshot(other)).habits.some(
      (item) => item.title === 'Academia atualizada',
    ),
  ).toBe(true)
})

test('duas abas preservam a quantidade salva e o rascunho de registro de hábito', async ({
  page,
  context,
}) => {
  await page.goto('/habitos')
  const other = await context.newPage()
  await other.goto('/habitos')
  for (const tab of [page, other])
    await tab
      .getByRole('button', { name: 'Registrar Estudo', exact: true })
      .click()
  await page.getByLabel('Quantidade (min)', { exact: true }).fill('30')
  await other.getByLabel('Quantidade (min)', { exact: true }).fill('5')
  await page
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect
    .poll(async () => (await snapshot(page)).habitLogs[0]!.value)
    .toBe(30)
  await other
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect(
    other.getByRole('dialog').getByText(/mudou em outra aba/),
  ).toBeVisible()
  await expect(
    other.getByLabel('Quantidade (min)', { exact: true }),
  ).toHaveValue('5')
  expect((await snapshot(other)).habitLogs[0]!.value).toBe(30)
  expect(
    (
      await new AxeBuilder({ page: other })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
})

test('perfil preserva fixação concorrente e recusa sobrescrever outra edição', async ({
  page,
  context,
}) => {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click()
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Perfil local auditado')
  const other = await context.newPage()
  await other.goto('/metas?project=example-project')
  await other
    .getByRole('button', { name: 'Fixar no perfil', exact: true })
    .click()
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  expect((await snapshot(page)).profile?.pinned).toEqual([
    { type: 'projects', id: 'example-project' },
  ])
  await other.goto('/perfil')
  for (const tab of [page, other])
    await tab
      .getByRole('button', { name: 'Editar perfil', exact: true })
      .click()
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Nome da primeira aba')
  await other
    .getByLabel('Uma frase sua', { exact: true })
    .fill('Frase que permanece no rascunho')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await other
    .getByRole('button', { name: 'Salvar perfil', exact: true })
    .click()
  await expect(
    other.getByRole('dialog').getByText(/perfil mudou em outra aba/),
  ).toBeVisible()
  await expect(other.getByLabel('Uma frase sua', { exact: true })).toHaveValue(
    'Frase que permanece no rascunho',
  )
  expect((await snapshot(other)).profile?.name).toBe('Nome da primeira aba')
})

test('duas abas compartilham um timer, refresh e segundo plano não duplicam nem concluem tarefa', async ({
  page,
  context,
}) => {
  const epoch = new Date('2026-12-31T12:00:00Z').getTime()
  await page.clock.setFixedTime(new Date(epoch))
  await page.goto('/foco?task=example-task-0')
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  const original = (await snapshot(page)).focusSessions[0]!
  const other = await context.newPage()
  await other.clock.setFixedTime(new Date(epoch + 10_000))
  await other.goto('/foco')
  await expect(
    other.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  await other.getByRole('button', { name: 'Pausar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Retomar', exact: true }),
  ).toBeVisible()
  await page.clock.setFixedTime(new Date(epoch + 30_000))
  await page.getByRole('button', { name: 'Retomar', exact: true }).click()
  await expect
    .poll(async () => (await snapshot(page)).focusSessions[0]!.timerState)
    .toBe('running')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  await other.bringToFront()
  // Fixed timestamps avoid relying on interval callbacks or background throttling.
  await page.clock.setFixedTime(new Date(epoch + 3_000_000))
  await page.bringToFront()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByText(
      'Tempo encerrado. Confirme a conclusão quando estiver pronto.',
      { exact: true },
    ),
  ).toBeVisible()
  const before = await snapshot(page)
  expect(before.focusSessions).toHaveLength(1)
  expect(before.focusSessions[0]!.id).toBe(original.id)
  expect(before.focusSessions[0]!.status).toBe('in-progress')
  expect(before.tasks[0]!.status).toBe('todo')
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Concluir sessão', exact: true })
    .click()
  await expect(
    other.getByRole('button', { name: 'Iniciar', exact: true }),
  ).toBeVisible()
  const after = await snapshot(other)
  expect(after.focusSessions).toHaveLength(1)
  expect(after.focusSessions[0]!.status).toBe('completed')
  expect(after.focusSessions[0]!.elapsedMs).toBe(original.plannedSeconds * 1000)
  expect(after.tasks[0]!.status).toBe('todo')
  expect(after.tasks[0]!.focusMinutes).toBe(original.plannedSeconds / 60)
  expect(
    after.experience.filter((event) => event.kind === 'focus'),
  ).toHaveLength(1)
})

for (const format of ['json', 'md'] as const) {
  test(`backup ${format}: restaura todos os campos e metadados em banco descartável`, async ({
    page,
  }) => {
    await page.goto('/preferencias')
    const now = new Date()
    const timestamp = now.toISOString()
    const date = timestamp.slice(0, 10)
    const fixture = buildSeed(now)
    for (const name of collections)
      for (const item of fixture[name]) item.isExample = false
    fixture.profile = {
      ...defaultProfile(),
      name: 'Auditoria',
      handle: '@atlas',
      pinned: [{ type: 'projects', id: 'example-project' }],
    }
    fixture.flashcards = [
      {
        id: 'audit-card',
        question: 'Pilha?',
        answer: 'LIFO',
        tags: ['aula'],
        links: [{ type: 'notes', id: fixture.notes[0]!.id }],
        createdAt: timestamp,
        updatedAt: timestamp,
        isExample: false,
        status: 'active',
        review: initialReview(now),
      },
    ]
    fixture.focusSessions = [
      {
        id: 'audit-session',
        title: 'Foco real',
        tags: ['atlas'],
        links: [{ type: 'projects', id: 'example-project' }],
        isExample: false,
        taskId: fixture.tasks[0]!.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        mode: 'focus',
        plannedSeconds: 60,
        status: 'completed',
        timerState: 'paused',
        elapsedMs: 60_000,
        segmentStartedAt: null,
        startedAt: new Date(now.getTime() - 60_000).toISOString(),
        endedAt: timestamp,
      },
    ]
    fixture.tasks[0]!.focusMinutes = 1
    fixture.activity = [
      {
        key: 'focus:audit-session',
        kind: 'focus',
        sourceId: 'audit-session',
        title: 'Foco real',
        date,
        at: timestamp,
        value: 1,
      },
    ]
    fixture.experience = [
      experienceEvent('focus', 'audit-session', date, timestamp),
    ]
    // Clear only this fresh test context, through the real strong-confirmation UI.
    await page
      .getByRole('button', { name: 'Limpar todos os dados', exact: true })
      .click()
    await page.getByLabel('Digite APAGAR TUDO').fill('APAGAR TUDO')
    await page.getByRole('checkbox', { name: /Entendo/ }).check()
    await page
      .getByRole('button', { name: 'Apagar definitivamente', exact: true })
      .click()
    await page
      .getByLabel('Arquivo para importar', { exact: true })
      .setInputFiles({
        name: 'fixture.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            format: 'atlas',
            schemaVersion: 1,
            exportedAt: timestamp,
            data: fixture,
          }),
        ),
      })
    await page
      .getByRole('button', { name: 'Confirmar importação', exact: true })
      .click()
    await expect
      .poll(async () => (await snapshot(page)).flashcards.length)
      .toBe(1)
    const before = await snapshot(page)
    const download = page.waitForEvent('download')
    await page
      .getByRole('button', {
        name: format === 'json' ? 'Exportar JSON' : 'Exportar Markdown',
        exact: true,
      })
      .click()
    const text = await readFile((await (await download).path())!, 'utf8')
    await page
      .getByRole('button', { name: 'Limpar todos os dados', exact: true })
      .click()
    await page.getByLabel('Digite APAGAR TUDO').fill('APAGAR TUDO')
    await page.getByRole('checkbox', { name: /Entendo/ }).check()
    await page
      .getByRole('button', { name: 'Apagar definitivamente', exact: true })
      .click()
    expect(await snapshot(page)).toMatchObject({
      profile: null,
      activity: [],
      experience: [],
    })
    await page
      .getByLabel('Arquivo para importar', { exact: true })
      .setInputFiles({
        name: `atlas.${format}`,
        mimeType: format === 'json' ? 'application/json' : 'text/markdown',
        buffer: Buffer.from(text),
      })
    await page
      .getByRole('button', { name: 'Confirmar importação', exact: true })
      .click()
    await expect.poll(async () => snapshot(page)).toEqual(before)
    await page.reload()
    expect(await snapshot(page)).toEqual(before)
    await writeFile(
      `docs/roundtrip-9b-${format}.json`,
      JSON.stringify(
        {
          format,
          equal: true,
          collections: Object.fromEntries(
            collections.map((name) => [name, before[name].length]),
          ),
          profile: Boolean(before.profile),
          activity: before.activity.length,
          experience: before.experience.length,
        },
        null,
        2,
      ),
    )
  })
}
