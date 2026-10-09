import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { sampleRoutine } from '../src/test/routine-fixture.js'
import type { Habit, HabitLog } from '../src/data/models.js'
import type { WeeklyRoutine } from '../src/data/routine-models.js'

async function state(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{
        habits: Habit[]
        logs: HabitLog[]
        routine: WeeklyRoutine | null
        experience: unknown
        activity: unknown
      }>((resolve, reject) => {
        const open = indexedDB.open('atlas-local')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction(['habits', 'habitLogs', 'meta'], 'readonly')
          const h = tx.objectStore('habits').getAll(),
            l = tx.objectStore('habitLogs').getAll(),
            m = tx.objectStore('meta').getAll()
          tx.oncomplete = () => {
            const meta = m.result as { key: string; value: unknown }[]
            db.close()
            resolve({
              habits: h.result as Habit[],
              logs: l.result as HabitLog[],
              routine: (meta.find((m) => m.key === 'weeklyRoutine')?.value ??
                null) as WeeklyRoutine | null,
              experience: meta.find((m) => m.key === 'experience')?.value ?? [],
              activity: meta.find((m) => m.key === 'activity')?.value ?? [],
            })
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
      }),
  )
}
async function prepare(page: Page) {
  await page.clock.install({ time: new Date('2026-10-09T12:00:00') })
  await page.goto('/habitos')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hábitos' }),
  ).toBeVisible()
}
async function importRoutine(page: Page, cancel = false) {
  await page
    .getByRole('button', { name: 'Importar rotina semanal', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Revisar rotina semanal' })
  await dialog.getByLabel('Arquivo de rotina').setInputFiles({
    name: 'rotina-exemplo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sampleRoutine())),
  })
  await expect(
    dialog.getByRole('heading', { name: 'Associar históricos' }),
  ).toBeVisible()
  if (cancel) {
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
    return
  }
  await dialog
    .getByRole('button', { name: 'Confirmar e aplicar rotina', exact: true })
    .click()
  await expect(dialog.getByRole('status')).toContainText('Rotina aplicada')
  await dialog.getByRole('button', { name: 'Concluir', exact: true }).click()
}

test('revisa sem aplicar, associa ID existente e não gera XP/atividade ao trocar datas', async ({
  page,
}) => {
  await prepare(page)
  const before = await state(page)
  await importRoutine(page, true)
  expect(await state(page)).toEqual(before)
  await page
    .getByRole('button', { name: 'Importar rotina semanal', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Revisar rotina semanal' })
  await dialog.getByLabel('Arquivo de rotina').setInputFiles({
    name: 'rotina-exemplo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sampleRoutine())),
  })
  const old = before.habits.find((h) => h.kind === 'binary')!
  await dialog.getByLabel('Histórico para Começar o dia').selectOption(old.id)
  await dialog
    .getByRole('button', { name: 'Confirmar e aplicar rotina' })
    .click()
  await expect(dialog.getByRole('status')).toContainText('Rotina aplicada')
  await dialog.getByRole('button', { name: 'Concluir' }).click()
  const after = await state(page)
  expect(after.habits).toHaveLength(before.habits.length + 10)
  expect(
    after.habits
      .find((h) => h.id === old.id)
      ?.scheduleVersions?.at(-1)
      ?.schedule.days.find((d) => d.weekday === 5)?.label,
  ).toBe('Começar o dia 5')
  expect(after.logs).toEqual(before.logs)
  expect(after.experience).toEqual(before.experience)
  expect(after.activity).toEqual(before.activity)
  await page.getByRole('button', { name: 'Ontem', exact: true }).click()
  await expect(page.getByLabel('Dia dos hábitos', { exact: true })).toHaveValue(
    '2026-10-08',
  )
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
  await page.reload()
  expect((await state(page)).routine).toEqual(after.routine)
})

test('Hoje/Ontem, madrugada, opcionais e virada de dia salvam exclusivamente na data escolhida', async ({
  page,
}) => {
  await prepare(page)
  await importRoutine(page)
  const before = await state(page)
  await page.clock.setSystemTime(new Date('2026-10-10T03:00:00'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByLabel('Dia dos hábitos', { exact: true })).toHaveValue(
    '2026-10-10',
  )
  const night = page.getByRole('complementary', { name: 'Noite anterior' })
  await expect(night).toContainText('9 de outubro')
  await night.getByRole('button', { name: 'Registrar em Ontem' }).click()
  const dialog = page.getByRole('dialog', { name: 'Registrar dia' })
  await expect(dialog.getByLabel('Data', { exact: true })).toHaveValue(
    '2026-10-09',
  )
  await expect(dialog).toContainText('Atribuição: sexta-feira, 9 de outubro')
  await dialog.getByRole('checkbox', { name: 'Concluído', exact: true }).check()
  await dialog.getByRole('button', { name: 'Salvar registro' }).click()
  await page.getByRole('button', { name: 'Ontem', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Marcar Leitura exemplo 5 como concluído',
      exact: true,
    })
    .click()
  await expect
    .poll(
      async () =>
        (await state(page)).logs.filter(
          (l) =>
            l.date === '2026-10-09' &&
            !before.logs.some((old) => old.id === l.id),
        ).length,
    )
    .toBe(2)
  expect(
    (await state(page)).logs.filter((l) => l.date === '2026-10-10'),
  ).toEqual(before.logs.filter((l) => l.date === '2026-10-10'))
  await page.clock.setSystemTime(new Date('2026-10-12T08:00:00'))
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  )
  await expect(page.getByLabel('Dia dos hábitos', { exact: true })).toHaveValue(
    '2026-10-09',
  )
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
  await expect(page.getByLabel('Dia dos hábitos', { exact: true })).toHaveValue(
    '2026-10-12',
  )
  await page.getByLabel('Dia dos hábitos', { exact: true }).fill('2026-10-10')
  await expect(
    page.getByRole('button', {
      name: 'Marcar Leitura exemplo 6 como concluído',
      exact: true,
    }),
  ).not.toBeVisible()
  await page.getByText('Opcionais (', { exact: false }).click()
  await expect(
    page.getByRole('button', {
      name: 'Marcar Leitura exemplo 6 como concluído',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.locator('.section-heading .form-help').first(),
  ).toContainText('0 de 10 obrigatórios concluídos')
  await page
    .getByRole('button', {
      name: 'Marcar Leitura exemplo 6 como concluído',
      exact: true,
    })
    .click()
  await expect
    .poll(async () => {
      const saved = await state(page)
      const reading = saved.habits.find((h) => h.title === 'Leitura exemplo')!
      return saved.logs.find(
        (l) => l.habitId === reading.id && l.date === '2026-10-10',
      )?.value
    })
    .toBe(1)
  await expect(
    page.locator('.section-heading .form-help').first(),
  ).toContainText('0 de 10 obrigatórios concluídos')
  await page.goto('/')
  await expect(
    page.getByRole('region', { name: 'Rotina do dia' }),
  ).toContainText('Tipo fictício 1')
  await expect(
    page.getByRole('region', { name: 'Rotina do dia' }),
  ).toContainText('Disciplina exemplo A')
})

test('configuração rejeita JSON inválido, mantém histórico no backup e funciona offline', async ({
  page,
  context,
}) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Importar rotina semanal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revisar rotina semanal' })
  await dialog.getByLabel('Arquivo de rotina').setInputFiles({
    name: 'invalido.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  })
  await expect(dialog.getByRole('alert')).toContainText('ilegível')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Importar rotina semanal' }),
  ).toBeFocused()
  await importRoutine(page)
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Seus dados' })
  const downloadPromise = page.waitForEvent('download')
  await panel
    .getByRole('button', { name: 'Exportar JSON', exact: true })
    .click()
  const download = await downloadPromise,
    path = await download.path()
  expect(path).toBeTruthy()
  const backup = JSON.parse(await readFile(path!, 'utf8')) as {
    data: { routine: WeeklyRoutine; habits: Habit[] }
  }
  expect(backup.data.routine).toEqual((await state(page)).routine)
  expect(backup.data.habits.filter((h) => h.scheduleVersions)).toHaveLength(11)
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Hábitos' }),
  ).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Marcar Começar o dia 5 como concluído',
      exact: true,
    }),
  ).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Marcar Começar o dia 5 como concluído',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Desmarcar Começar o dia 5',
      exact: true,
    }),
  ).toBeVisible()
  await expect
    .poll(async () => {
      const saved = await state(page)
      const habit = saved.habits.find((h) => h.title === 'Começar o dia')!
      return saved.logs.find(
        (l) => l.habitId === habit.id && l.date === '2026-10-09',
      )?.value
    })
    .toBe(1)
  await context.setOffline(false)
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Desmarcar Começar o dia 5',
      exact: true,
    }),
  ).toBeVisible()
})

test('edição por teclado, temas, mobile e texto 200% mantêm controles acessíveis', async ({
  page,
}) => {
  await prepare(page)
  await importRoutine(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
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
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    }
  }
  await page.setViewportSize({ width: 375, height: 900 })
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
  await page
    .getByRole('button', { name: 'Importar rotina semanal', exact: true })
    .click()
  const review = page.getByRole('dialog', { name: 'Revisar rotina semanal' })
  await review.getByLabel('Arquivo de rotina').setInputFiles({
    name: 'rotina-exemplo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sampleRoutine())),
  })
  await expect(
    review.getByRole('heading', { name: 'Associar históricos' }),
  ).toBeVisible()
  expect(await review.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  )
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await page
    .getByRole('combobox', { name: 'Histórico', exact: true })
    .selectOption({ label: 'Planejamento exemplo' })
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Editar hábito' })
  await expect(
    dialog.getByRole('combobox', { name: 'Dias programados', exact: true }),
  ).toHaveValue('weekdays')
  await dialog.getByText('Dias, horários e variações', { exact: true }).click()
  await expect(
    dialog.getByRole('checkbox', {
      name: 'Programar Sexta-feira',
      exact: true,
    }),
  ).toBeChecked()
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  )
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Editar hábito', exact: true }),
  ).toBeFocused()
})

test('edita variações com ID estável e registra Ontem pela tela Hoje', async ({
  page,
}) => {
  await prepare(page)
  await importRoutine(page)
  const original = (await state(page)).habits.find(
    (h) => h.title === 'Começar o dia',
  )!
  await page
    .getByRole('combobox', { name: 'Histórico', exact: true })
    .selectOption(original.id)
  await page.getByRole('button', { name: 'Editar hábito', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Editar hábito' })
  await sheet.getByText('Dias, horários e variações', { exact: true }).click()
  await sheet
    .getByLabel('Label · Sexta-feira', { exact: true })
    .fill('Início tranquilo')
  await sheet.getByLabel('Horário · Sexta-feira', { exact: true }).fill('06:25')
  await sheet
    .getByRole('button', { name: 'Salvar hábito', exact: true })
    .click()
  await expect(sheet).not.toBeVisible()
  const updated = (await state(page)).habits.find((h) => h.id === original.id)!
  expect(
    updated.scheduleVersions
      ?.at(-1)
      ?.schedule.days.find((d) => d.weekday === 5),
  ).toMatchObject({ label: 'Início tranquilo', time: '06:25' })
  expect((await state(page)).habits).toHaveLength(17)
  await page.clock.setSystemTime(new Date('2026-10-10T10:00:00'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Ontem', exact: true }).click()
  await page
    .getByRole('button', {
      name: 'Marcar Início tranquilo como concluído',
      exact: true,
    })
    .click()
  await expect
    .poll(
      async () =>
        (await state(page)).logs.find(
          (l) => l.habitId === original.id && l.date === '2026-10-09',
        )?.value,
    )
    .toBe(1)
  expect(
    (await state(page)).logs.some(
      (l) => l.habitId === original.id && l.date === '2026-10-10',
    ),
  ).toBe(false)
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: 'Marcar Começar o dia 6 como concluído',
      exact: true,
    }),
  ).toBeVisible()
})
