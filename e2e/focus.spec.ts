import { evidencePath } from './evidence.js'
import { chooseMenu } from './menu-helpers.js'
import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  collections,
  snapshotSchema,
  type Snapshot,
} from '../src/data/models.js'

const epoch = new Date('2026-10-03T12:00:00Z').getTime()
test.use({ actionTimeout: 15000 })
async function data(page: Page): Promise<Snapshot> {
  return snapshotSchema.parse(
    await page.evaluate(
      (names) =>
        new Promise<Record<string, unknown[]>>((resolve, reject) => {
          const request = indexedDB.open('atlas-local')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const transaction = db.transaction(names, 'readonly')
            const result: Record<string, unknown[]> = {}
            for (const name of names) {
              const read = transaction.objectStore(name).getAll()
              read.onsuccess = () => {
                result[name] = read.result as unknown[]
              }
            }
            transaction.oncomplete = () => {
              db.close()
              resolve(result)
            }
            transaction.onerror = () => {
              db.close()
              reject(transaction.error)
            }
          }
        }),
      [...collections],
    ),
  )
}
async function at(page: Page, seconds: number) {
  await page.clock.setFixedTime(new Date(epoch + seconds * 1000))
}
async function openFocus(page: Page) {
  await page.goto('/foco')
  await expect(
    page.getByRole('heading', { name: 'Foco', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Iniciar', exact: true }),
  ).toBeEnabled()
}
async function durations(page: Page, focus = 1) {
  await page.getByText('Preferências de duração', { exact: true }).click()
  await page.getByLabel('Foco em minutos', { exact: true }).fill(String(focus))
  await page.getByLabel('Pausa curta em minutos', { exact: true }).fill('1')
  await page.getByLabel('Pausa longa em minutos', { exact: true }).fill('2')
  await page
    .getByRole('button', { name: 'Salvar durações', exact: true })
    .click()
  await page.getByText('Preferências de duração', { exact: true }).click()
}
async function createCard(
  page: Page,
  question = 'Como funciona uma pilha?',
  answer = 'O último elemento a entrar é o primeiro a sair.',
) {
  await page.goto('/estudos')
  await page
    .getByRole('button', { name: 'Novo flashcard', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Novo flashcard',
    exact: true,
  })
  await expect(dialog.getByLabel('Pergunta', { exact: true })).toBeFocused()
  await dialog.getByLabel('Pergunta', { exact: true }).fill(question)
  await dialog.getByLabel('Resposta', { exact: true }).fill(answer)
  await dialog.getByText('Vínculos, tags e revisão', { exact: true }).click()
  await dialog
    .getByRole('combobox', { name: 'Nota vinculada', exact: true })
    .selectOption('example-note-0')
  await dialog
    .getByRole('combobox', { name: 'Disciplina vinculada', exact: true })
    .selectOption('example-subject-0')
  await dialog
    .getByRole('combobox', { name: 'Trilha vinculada', exact: true })
    .selectOption('example-study-path-0')
  await dialog.getByLabel('Tags', { exact: true }).fill('revisão, faculdade')
  await dialog
    .getByRole('button', { name: 'Salvar flashcard', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: question, level: 3, exact: true }),
  ).toBeVisible()
}
function errors(page: Page) {
  const seen: string[] = []
  page.on('pageerror', (error) => seen.push(error.message))
  return seen
}

test('flashcard liga nota/disciplina/trilha, revela, avalia por teclado e desfaz exclusão após refresh', async ({
  page,
}) => {
  const failures = errors(page)
  await at(page, 0)
  await createCard(page)
  let snapshot = await data(page)
  expect(snapshot.flashcards[0]!.links).toHaveLength(3)
  await page
    .getByRole('button', { name: 'Revelar resposta', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByText('O último elemento a entrar é o primeiro a sair.', {
      exact: true,
    }),
  ).toBeVisible()
  await page.keyboard.press('5')
  await expect(
    page.getByText('Revisão de hoje em dia.', { exact: false }),
  ).toBeVisible()
  snapshot = await data(page)
  expect(snapshot.flashcards[0]!.review).toMatchObject({
    quality: 5,
    repetitions: 1,
    interval: 1,
    nextReview: '2026-10-04',
  })
  await at(page, 86400)
  await page.reload()
  await page
    .getByRole('button', { name: 'Editar flashcard', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Pergunta', exact: true })
    .fill('O que significa LIFO 0–5?')
  await page.keyboard.press('2')
  expect((await data(page)).flashcards[0]!.review.quality).toBe(5)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Editar flashcard', exact: true }),
  ).toBeFocused()
  await page
    .getByRole('button', { name: 'Excluir flashcard', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await page.reload()
  await page
    .getByRole('button', {
      name: 'Desfazer exclusão do flashcard',
      exact: true,
    })
    .click()
  expect((await data(page)).flashcards[0]!.review).toEqual(
    snapshot.flashcards[0]!.review,
  )
  await page
    .getByRole('link', { name: 'Abrir disciplina', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Estruturas de Dados', level: 1 }),
  ).toBeVisible()
  expect(failures).toEqual([])
})

test('sessão encerrada permite desvincular tarefa e desfazer após refresh, preservando tempo e contexto', async ({
  page,
}) => {
  await at(page, 0)
  await page.goto('/foco?task=example-task-0')
  await expect(
    page.getByRole('button', { name: 'Iniciar', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await at(page, 20)
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Encerrar como interrompida', exact: true })
    .click()
  const before = await data(page)
  await page
    .getByText('Manter ou remover o vínculo da tarefa', { exact: true })
    .click()
  await page
    .getByRole('button', {
      name: 'Desvincular tarefa da sessão Revisar estruturas de dados',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Sessões registradas', exact: true }),
  ).toBeFocused()
  let current = await data(page)
  expect(current.focusSessions[0]).toMatchObject({
    taskId: null,
    elapsedMs: 20000,
    links: before.focusSessions[0]!.links,
  })
  expect(
    current.tasks.find((task) => task.id === 'example-task-0')!.focusMinutes,
  ).toBe(0)
  await page.reload()
  await page
    .getByRole('button', {
      name: 'Desfazer desvinculação da tarefa',
      exact: true,
    })
    .click()
  current = await data(page)
  expect(current.focusSessions[0]!.taskId).toBe('example-task-0')
  expect(current.focusSessions[0]!.elapsedMs).toBe(20000)
  expect(
    current.tasks.find((task) => task.id === 'example-task-0')!.focusMinutes,
  ).toBeCloseTo(20 / 60)
})

test('Pomodoro de tarefa inicia, pausa, recupera pausa no refresh, retoma e encerra por teclado com duração real', async ({
  page,
}) => {
  const failures = errors(page)
  await at(page, 0)
  await page.goto('/tarefas')
  await page
    .getByRole('link', {
      name: 'Focar em Revisar estruturas de dados',
      exact: true,
    })
    .click()
  await durations(page)
  await page.getByRole('heading', { name: 'Foco', level: 1 }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  await at(page, 10)
  await expect(page.getByRole('timer')).toHaveText('00:50')
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Retomar', exact: true }),
  ).toBeVisible()
  await at(page, 40)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('00:50')
  await page.getByRole('heading', { name: 'Foco', level: 1 }).focus()
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  await at(page, 65)
  await expect(page.getByRole('timer')).toHaveText('00:25')
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('dialog', { name: 'Encerrar sessão?' })
  await expect(
    dialog.getByRole('button', { name: 'Continuar sessão', exact: true }),
  ).toBeFocused()
  await dialog
    .getByRole('button', { name: 'Encerrar como interrompida', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Iniciar', exact: true }),
  ).toBeFocused()
  const snapshot = await data(page)
  expect(snapshot.focusSessions).toHaveLength(1)
  expect(snapshot.focusSessions[0]).toMatchObject({
    status: 'interrupted',
    elapsedMs: 35000,
    taskId: 'example-task-0',
  })
  expect(
    snapshot.tasks.find((task) => task.id === 'example-task-0')!.focusMinutes,
  ).toBeCloseTo(35 / 60)
  await page.getByRole('link', { name: 'Atlas', exact: true }).click()
  await expect(
    page.getByText('de foco registrados neste contexto.', { exact: false }),
  ).toBeVisible()
  expect(failures).toEqual([])
})

test('tempo em segundo plano e refresh não concluem nem duplicam sessão; confirmação registra uma vez', async ({
  page,
  context,
}) => {
  await at(page, 0)
  await openFocus(page)
  await durations(page)
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeVisible()
  const background = await context.newPage()
  await background.goto('about:blank')
  await background.bringToFront()
  await at(page, 15)
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('00:45')
  await page.goto('/estudos') // No mounted timer and no interval ticks in the Focus view.
  await at(page, 3600)
  await page.goto('/foco')
  await page.bringToFront()
  await expect(page.getByRole('timer')).toHaveText('00:00')
  await expect(
    page.getByText(
      'Tempo encerrado. Confirme a conclusão quando estiver pronto.',
      { exact: true },
    ),
  ).toBeVisible()
  let snapshot = await data(page)
  expect(snapshot.focusSessions).toHaveLength(1)
  expect(snapshot.focusSessions[0]!.status).toBe('in-progress')
  await page.reload()
  expect((await data(page)).focusSessions[0]!.status).toBe('in-progress')
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Concluir sessão', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Iniciar', exact: true }),
  ).toBeVisible()
  await page.reload()
  snapshot = await data(page)
  expect(snapshot.focusSessions).toHaveLength(1)
  expect(snapshot.focusSessions[0]).toMatchObject({
    status: 'completed',
    elapsedMs: 60000,
  })
  await background.close()
})

test('reiniciar guarda tentativa interrompida, preferências persistem e pausas têm registros próprios', async ({
  page,
}) => {
  await at(page, 0)
  await openFocus(page)
  await durations(page)
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await at(page, 12)
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  expect((await data(page)).focusSessions[0]).toMatchObject({
    status: 'interrupted',
    elapsedMs: 12000,
  })
  await page.getByRole('radio', { name: 'Pausa curta', exact: true }).check()
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await at(page, 72)
  await expect(page.getByRole('timer')).toHaveText('00:00')
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Concluir sessão', exact: true })
    .click()
  expect(
    (await data(page)).focusSessions.some(
      (session) =>
        session.mode === 'shortBreak' && session.status === 'completed',
    ),
  ).toBe(true)
  await page.getByRole('radio', { name: 'Pausa longa', exact: true }).check()
  await expect(page.getByRole('timer')).toHaveText('02:00')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await page.getByText('Preferências de duração', { exact: true }).click()
  await expect(
    page.getByLabel('Pausa longa em minutos', { exact: true }),
  ).toHaveValue('2')
  await page.getByLabel('Foco em minutos', { exact: true }).focus()
  await page.keyboard.press('Space')
  expect((await data(page)).focusSessions).toHaveLength(2)
  await page.getByText('Preferências de duração', { exact: true }).click()
  await page.getByRole('radio', { name: 'Pausa longa', exact: true }).check()
  await chooseMenu(
    page,
    page.getByRole('combobox', { name: 'Tarefa vinculada', exact: true }),
    'Revisar estruturas de dados',
  )
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await at(page, 77)
  await page.reload()
  const reset = page.getByRole('button', { name: 'Reiniciar', exact: true })
  await reset.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('timer')).toHaveText('02:00')
  await expect(
    page.getByRole('radio', { name: 'Pausa longa', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('combobox', { name: 'Tarefa vinculada', exact: true }),
  ).toHaveAttribute('data-value', 'example-task-0')
  expect(
    (await data(page)).focusSessions.find(
      (session) => session.mode === 'longBreak',
    ),
  ).toMatchObject({
    status: 'interrupted',
    mode: 'longBreak',
    elapsedMs: 5000,
  })
})

for (const format of ['json', 'md'])
  test(`backup ${format} restaura flashcards e sessão pausada com todos os vínculos e timestamps`, async ({
    page,
  }) => {
    await at(page, 0)
    await createCard(page)
    await openFocus(page)
    await chooseMenu(
      page,
      page.getByRole('combobox', { name: 'Tarefa vinculada', exact: true }),
      'Revisar estruturas de dados',
    )
    await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Pausar', exact: true }),
    ).toBeEnabled()
    await at(page, 20)
    await page.getByRole('button', { name: 'Pausar', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Retomar', exact: true }),
    ).toBeVisible()
    const before = await data(page)
    await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Seus dados', exact: true })
    const downloading = page.waitForEvent('download')
    await dialog
      .getByRole('button', {
        name: format === 'json' ? 'Exportar JSON' : 'Exportar Markdown',
        exact: true,
      })
      .click()
    const downloaded = await downloading
    const contents = await readFile((await downloaded.path())!, 'utf8')
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('atlas-local')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const names = Array.from(db.objectStoreNames)
            const tx = db.transaction(names, 'readwrite')
            for (const name of names) tx.objectStore(name).clear()
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }),
    )
    expect(
      Object.values(await data(page)).every((items) =>
        Array.isArray(items) ? items.length === 0 : items === null,
      ),
    ).toBe(true)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: `atlas.${format}`,
      mimeType: format === 'json' ? 'application/json' : 'text/markdown',
      buffer: Buffer.from(contents),
    })
    await dialog
      .getByRole('button', { name: 'Confirmar importação', exact: true })
      .click()
    await expect
      .poll(async () => (await data(page)).focusSessions.length)
      .toBe(1)
    for (const name of collections)
      for (const item of before[name]) item.isExample = false
    expect(await data(page)).toEqual(before)
    await page.reload()
    await expect(page.getByRole('timer')).toHaveText('24:40')
    expect(await data(page)).toEqual(before)
  })

test('Foco e revisão mantêm contraste, teclado, 375/768/1280, temas, texto 200% e preferências acessíveis', async ({
  page,
}) => {
  test.setTimeout(300000)
  const failures = errors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await createCard(
    page,
    'Qual é o próximo passo para compreender estruturas de dados e praticar com uma implementação pequena?',
    'Uma resposta confortável para leitura.\n\n'.repeat(30),
  )
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      for (const route of ['estudos', 'foco']) {
        await page.goto(`/${route}`)
        if (route === 'estudos')
          await page
            .getByRole('button', { name: 'Revelar resposta', exact: true })
            .click()
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
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
        await page.screenshot({
          path: evidencePath(
            `docs/screenshots/etapa-7b2-${route}-${theme.toLowerCase()}-${width}.png`,
          ),
        })
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations,
        ).toEqual([])
        await page.evaluate(() => {
          document.documentElement.style.fontSize = ''
        })
      }
    }
  }
  await page.getByRole('button', { name: 'Aparência', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Reduzir transparência', exact: true })
    .check()
  await page.keyboard.press('Escape')
  await expect(page.locator('.toolbar')).toHaveCSS('backdrop-filter', 'none')
  await expect(page.locator('.focus-stage')).toHaveCSS(
    'backdrop-filter',
    'none',
  )
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar', exact: true }),
  ).toBeEnabled()
  await page.keyboard.press('Escape')
  const dialog = page.getByRole('dialog', { name: 'Encerrar sessão?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.glass')).toHaveCSS('backdrop-filter', 'none')
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(failures).toEqual([])
})
