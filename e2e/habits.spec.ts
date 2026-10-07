import { evidencePath } from './evidence.js'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import type { Habit, HabitLog } from '../src/data/models.js'

interface HabitState {
  habit: Habit | null
  logs: HabitLog[]
}

async function readHabit(
  page: Page,
  title: string,
  habitId?: string,
): Promise<HabitState> {
  return page.evaluate(
    ({ habitTitle, id }) =>
      new Promise<HabitState>((resolve, reject) => {
        const open = indexedDB.open('atlas-local')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const transaction = database.transaction(
            ['habits', 'habitLogs'],
            'readonly',
          )
          const habitsRequest = transaction.objectStore('habits').getAll()
          const logsRequest = transaction.objectStore('habitLogs').getAll()
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            const habits = habitsRequest.result as Habit[]
            const logs = logsRequest.result as HabitLog[]
            const habit =
              habits.find((item) => item.title === habitTitle) ?? null
            database.close()
            resolve({
              habit,
              logs: logs.filter((log) => log.habitId === (habit?.id ?? id)),
            })
          }
        }
      }),
    { habitTitle: title, id: habitId },
  )
}

async function localDay(page: Page, offset = 0): Promise<string> {
  return page.evaluate((dayOffset) => {
    const day = new Date()
    day.setDate(day.getDate() + dayOffset)
    return [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    ].join('-')
  }, offset)
}

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function createHabit(page: Page, title: string, quantity = false) {
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo hábito', exact: true })
  await dialog.getByLabel('Nome', { exact: true }).fill(title)
  await dialog
    .getByRole('radio', {
      name: quantity ? 'Quantidade' : 'Simples',
      exact: true,
    })
    .check()
  if (quantity) {
    await dialog.getByLabel('Alvo diário', { exact: true }).fill('0.5')
    await dialog.getByLabel('Unidade', { exact: true }).fill('L')
  }
  await dialog.getByLabel(/^Frequência/).selectOption(quantity ? '7' : '3')
  await dialog.getByLabel(/^Tags/).fill('pessoal, teste')
  await dialog
    .getByRole('button', { name: 'Criar hábito', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', {
      name: `Ver histórico de ${title}`,
      exact: true,
    }),
  ).toBeVisible()
}

test('cria hábitos simples e quantitativos, registra descanso e persiste valores fracionários', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/habitos')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hábitos' }),
  ).toBeFocused()
  await createHabit(page, 'Caminhada de teste')
  await page
    .getByRole('button', {
      name: 'Marcar Caminhada de teste como concluído',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Desmarcar Caminhada de teste',
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Ver histórico de Caminhada de teste',
      exact: true,
    })
    .click()
  const yesterday = await localDay(page, -1)
  await page
    .getByTestId('heatmap')
    .locator(`button[data-date="${yesterday}"]`)
    .click()
  const dayDialog = page.getByRole('dialog', {
    name: 'Registrar dia',
    exact: true,
  })
  await expect(dayDialog.getByLabel('Data', { exact: true })).toHaveValue(
    yesterday,
  )
  await dayDialog
    .getByRole('checkbox', { name: 'Descanso', exact: true })
    .check()
  await dayDialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect(dayDialog).not.toBeVisible()
  const binary = await readHabit(page, 'Caminhada de teste')
  expect(binary.habit).toMatchObject({
    kind: 'binary',
    timesPerWeek: 3,
    tags: ['pessoal', 'teste'],
  })
  expect(binary.logs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ date: yesterday, rest: true }),
      expect.objectContaining({
        date: await localDay(page),
        value: 1,
        rest: false,
      }),
    ]),
  )

  await createHabit(page, 'Água de teste', true)
  await page
    .getByRole('button', { name: 'Registrar Água de teste', exact: true })
    .click()
  await dayDialog.getByLabel(/^Quantidade/).fill('0,5')
  await dayDialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect(dayDialog).not.toBeVisible()
  const quantity = await readHabit(page, 'Água de teste')
  expect(quantity.habit).toMatchObject({
    kind: 'quantity',
    target: 0.5,
    unit: 'L',
    timesPerWeek: 7,
  })
  expect(quantity.logs).toHaveLength(1)
  expect(quantity.logs[0]).toMatchObject({ value: 0.5, rest: false })
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Ver histórico de Água de teste',
      exact: true,
    }),
  ).toBeVisible()
  expect(await readHabit(page, 'Caminhada de teste')).toEqual(binary)
  expect(await readHabit(page, 'Água de teste')).toEqual(quantity)
  expect(errors).toEqual([])
})

test('edita hábito e recupera exclusão com os registros após recarregar', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/habitos')
  await createHabit(page, 'Leitura de teste')
  await page
    .getByRole('button', {
      name: 'Marcar Leitura de teste como concluído',
      exact: true,
    })
    .click()
  await page
    .getByRole('button', {
      name: 'Ver histórico de Leitura de teste',
      exact: true,
    })
    .click()
  const logged = await readHabit(page, 'Leitura de teste')
  const today = await localDay(page)
  await page
    .getByTestId('heatmap')
    .locator(`button[data-date="${today}"]`)
    .click()
  const dayDialog = page.getByRole('dialog', {
    name: 'Registrar dia',
    exact: true,
  })
  await dayDialog
    .getByRole('button', { name: 'Apagar registro', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(dayDialog).not.toBeVisible()
  await expect
    .poll(async () => (await readHabit(page, 'Leitura de teste')).logs)
    .toEqual([])
  await page.reload()
  await page
    .getByRole('button', { name: 'Desfazer exclusão', exact: true })
    .first()
    .click()
  await expect.poll(() => readHabit(page, 'Leitura de teste')).toEqual(logged)
  await page
    .getByRole('button', {
      name: 'Ver histórico de Leitura de teste',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Editar hábito', exact: true })
  await edit.getByLabel('Nome', { exact: true }).fill('Leitura em papel')
  await edit.getByLabel(/^Frequência/).selectOption('4')
  await edit.getByRole('button', { name: 'Salvar hábito', exact: true }).click()
  await expect(edit).not.toBeVisible()
  const before = await readHabit(page, 'Leitura em papel')
  expect(before.habit).toMatchObject({ timesPerWeek: 4 })
  expect(before.logs).toHaveLength(1)
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click()
  await edit
    .getByRole('button', { name: 'Excluir hábito', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(edit).not.toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Ver histórico de Leitura em papel',
      exact: true,
    }),
  ).not.toBeVisible()
  expect(await readHabit(page, 'Leitura em papel', before.habit?.id)).toEqual({
    habit: null,
    logs: [],
  })
  await page.reload()
  await page
    .getByRole('button', { name: 'Desfazer exclusão', exact: true })
    .first()
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Ver histórico de Leitura em papel',
      exact: true,
    }),
  ).toBeVisible()
  await expect.poll(() => readHabit(page, 'Leitura em papel')).toEqual(before)
  expect(errors).toEqual([])
})

test('heatmap navegável por teclado, tooltip, alternativa textual e sheet com foco contido', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/habitos')
  await page
    .getByRole('combobox', { name: /^Histórico/ })
    .selectOption({ label: 'Estudo' })
  const grid = page.getByTestId('heatmap')
  const day = grid.locator('button[tabindex="0"]')
  await expect(day).toHaveCount(1)
  await day.focus()
  const initialDate = await day.getAttribute('data-date')
  expect(initialDate).toBeTruthy()
  await page.keyboard.press('ArrowLeft')
  const previousWeek = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-date'),
  )
  const expected = new Date(`${initialDate}T12:00:00`)
  expected.setDate(expected.getDate() - 7)
  expect(previousWeek).toBe(
    [
      expected.getFullYear(),
      String(expected.getMonth() + 1).padStart(2, '0'),
      String(expected.getDate()).padStart(2, '0'),
    ].join('-'),
  )
  await page.keyboard.press('ArrowDown')
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', {
    name: 'Registrar dia',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true)
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused()
  await grid.locator('button[tabindex="0"]').hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText(/\d/)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ver em texto', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(29)
  await page.getByRole('button', { name: 'Anteriores', exact: true }).click()
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(29)
  await page.getByRole('button', { name: 'Recentes', exact: true }).click()
  expect(errors).toEqual([])
})

test('hábitos em 375, 768 e 1280 px, temas, alvos de toque, texto 200% e preferências de acessibilidade', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/habitos')
    await expect(page.getByTestId('heatmap')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      await page
        .getByTestId('heatmap')
        .locator('button[data-date]')
        .evaluateAll((buttons) =>
          buttons.every((button) => {
            const rect = button.getBoundingClientRect()
            return rect.width >= 44 && rect.height >= 44
          }),
        ),
    ).toBe(true)
    const weekday = page
      .getByTestId('heatmap')
      .locator('.heatmap-weekday')
      .first()
    await expect(weekday).toHaveCSS('position', 'sticky')
    expect(
      await weekday.evaluate((element) => {
        const scroller = element.closest('.heatmap-scroll')
        if (!scroller) return false
        const label = element.getBoundingClientRect()
        const plot = scroller.getBoundingClientRect()
        return label.left >= plot.left && label.right <= plot.right
      }),
    ).toBe(true)
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([])
    }
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-3-${width}.png`),
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Aparência', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Reduzir transparência', exact: true })
    .check()
  await expect(page.locator('.toolbar')).toHaveCSS('backdrop-filter', 'none')
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Novo hábito', exact: true })
  await expect(dialog.getByLabel('Nome', { exact: true })).toBeInViewport()
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.screenshot({
    path: evidencePath('docs/screenshots/etapa-3-texto-200.png'),
    fullPage: true,
  })
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Novo hábito', exact: true }),
  ).toBeFocused()
  expect(errors).toEqual([])
})

test('lista com mais de 200 hábitos virtualiza e alcança os extremos por teclado', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/habitos')
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await panel
    .getByRole('button', { name: 'Remover exemplos (20)', exact: true })
    .click()
  await expect(
    panel.getByText('0 registros salvos localmente', { exact: true }),
  ).toBeVisible()
  const now = new Date().toISOString()
  const habits: Habit[] = Array.from({ length: 210 }, (_, index) => ({
    id: `personal-${String(index).padStart(3, '0')}`,
    title: `Hábito ${String(index + 1).padStart(3, '0')}`,
    tags: ['teste'],
    links: [],
    createdAt: now,
    updatedAt: now,
    isExample: false,
    kind: 'binary',
    target: 1,
    unit: 'vez',
    timesPerWeek: 3,
  }))
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'habitos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'atlas',
        schemaVersion: 1,
        exportedAt: now,
        data: {
          tasks: [],
          habits,
          habitLogs: [],
          notes: [],
          goals: [],
          projects: [],
        },
      }),
    ),
  })
  await panel
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(
    panel.getByText('210 registros salvos localmente', { exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  const list = page.getByTestId('habit-list')
  const rows = list.locator('[data-habit-index]')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeLessThan(210)
  const first = list.getByRole('button', {
    name: 'Ver histórico de Hábito 001',
    exact: true,
  })
  await first.focus()
  await page.keyboard.press('End')
  const last = list.getByRole('button', {
    name: 'Ver histórico de Hábito 210',
    exact: true,
  })
  await expect(last).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Hábito 210', exact: true }),
  ).toBeVisible()
  await last.focus()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    list.getByRole('button', {
      name: 'Ver histórico de Hábito 002',
      exact: true,
    }),
  ).toBeFocused()
  expect(await rows.count()).toBeLessThan(210)
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  expect(errors).toEqual([])
})
