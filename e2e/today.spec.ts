import { evidencePath } from './evidence.js'
import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  collections,
  snapshotSchema,
  type Snapshot,
  type Task,
} from '../src/data/models.js'

// Each Playwright page belongs to a fresh disposable browser context. These
// flows never use a personal profile, attach to an existing tab, or erase a DB.
test.use({ actionTimeout: 15_000 })

async function readData(page: Page): Promise<Snapshot> {
  const data = await page.evaluate(
    (names) =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const request = indexedDB.open('atlas-local')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(names, 'readonly')
          const records: Record<string, unknown[]> = {}
          for (const name of names) {
            const read = transaction.objectStore(name).getAll()
            read.onsuccess = () => {
              records[name] = read.result as unknown[]
            }
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            database.close()
            resolve(records)
          }
        }
      }),
    [...collections],
  )
  return snapshotSchema.parse(data)
}

async function localDay(page: Page, offset = 0): Promise<string> {
  return page.evaluate((dayOffset) => {
    const date = new Date()
    date.setDate(date.getDate() + dayOffset)
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
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

async function expectAxe(page: Page): Promise<void> {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
}

async function createTask(
  page: Page,
  title: string,
  date?: string,
  details?: { time?: string; tags?: string },
): Promise<Task> {
  await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova tarefa', exact: true })
  await dialog.getByLabel('Nome', { exact: true }).fill(title)
  if (date) await dialog.getByLabel('Prazo', { exact: true }).fill(date)
  if (details?.time)
    await dialog.getByLabel('Horário', { exact: true }).fill(details.time)
  if (details?.tags)
    await dialog.getByLabel('Tags', { exact: true }).fill(details.tags)
  await dialog
    .getByRole('button', { name: 'Criar tarefa', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect
    .poll(async () =>
      (await readData(page)).tasks.find((task) => task.title === title),
    )
    .toBeTruthy()
  const saved = (await readData(page)).tasks.find(
    (task) => task.title === title,
  )
  if (!saved) throw new Error(`A tarefa ${title} não foi salva.`)
  return saved
}

async function openPalette(page: Page) {
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', {
    name: 'Captura rápida',
    exact: true,
  })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByLabel('Capturar ou navegar', { exact: true }),
  ).toBeFocused()
  return dialog
}

test('Hoje reúne tarefas e hábitos, sugere três prioridades e revisa pendências sem mudar prazos', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeFocused()
  for (const name of [
    'Tarefas do dia',
    'Hábitos de hoje',
    'Próximo compromisso',
    'Meta da semana',
  ]) {
    await expect(
      page.getByRole('heading', { name, level: 2, exact: true }),
    ).toBeVisible()
  }
  const today = await localDay(page)
  await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova tarefa', exact: true })
  await expect(dialog.getByLabel('Prazo', { exact: true })).toHaveValue(today)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Nova tarefa', exact: true }),
  ).toBeFocused()
  const fourth = await createTask(page, 'Quarta tarefa de teste')
  expect(fourth.dueDate).toBe(today)
  await expect(
    page.getByRole('status').filter({ hasText: 'Há 4 tarefas para hoje' }),
  ).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Adiar para amanhã: Quarta tarefa de teste',
      exact: true,
    })
    .click()
  await expect(page.locator(`[data-task-id="${fourth.id}"]`)).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Nova tarefa', exact: true }),
  ).toBeFocused()
  expect(
    (await readData(page)).tasks.find((task) => task.id === fourth.id)?.dueDate,
  ).toBe(await localDay(page, 1))
  await expect(
    page.getByText('Há 4 tarefas para hoje', { exact: false }),
  ).not.toBeVisible()

  await page.goto('/tarefas')
  const yesterday = await localDay(page, -1)
  const overdue = await createTask(page, 'Pendência de ontem', yesterday)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Revisar pendências', level: 2 }),
  ).toBeVisible()
  expect(
    (await readData(page)).tasks.find((task) => task.id === overdue.id)
      ?.dueDate,
  ).toBe(yesterday)
  await page
    .getByRole('button', { name: 'Concluir Pendência de ontem', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Revisar pendências', level: 2 }),
  ).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Nova tarefa', exact: true }),
  ).toBeFocused()
  expect(
    (await readData(page)).tasks.find((task) => task.id === overdue.id),
  ).toMatchObject({ status: 'done', dueDate: yesterday })
  await page.reload()
  expect(
    (await readData(page)).tasks.find((task) => task.id === fourth.id)?.dueDate,
  ).toBe(await localDay(page, 1))
  expect(errors).toEqual([])
})

test('revisão inclui compromisso vencido hoje e mantém compromisso sem horário nas tarefas do dia', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const noon = new Date()
  noon.setHours(12, 0, 0, 0)
  await page.clock.setFixedTime(noon)
  await page.goto('/tarefas')
  await expect(
    page.getByRole('heading', { name: 'Tarefas', level: 1, exact: true }),
  ).toBeFocused()
  const today = await localDay(page)
  const past = await createTask(page, 'Compromisso vencido de teste', today, {
    time: '00:00',
    tags: 'compromisso',
  })
  const noTime = await createTask(
    page,
    'Compromisso sem horário de teste',
    today,
    {
      tags: 'compromisso',
    },
  )
  await page.goto('/')
  const day = page.getByRole('region', { name: 'Tarefas do dia', exact: true })
  const review = page.getByRole('region', {
    name: 'Revisar pendências',
    exact: true,
  })
  await expect(review.locator(`[data-task-id="${past.id}"]`)).toBeVisible()
  await expect(day.locator(`[data-task-id="${past.id}"]`)).toHaveCount(0)
  await expect(day.locator(`[data-task-id="${noTime.id}"]`)).toBeVisible()
  await expect(review.locator(`[data-task-id="${noTime.id}"]`)).toHaveCount(0)
  const before = await readData(page)
  expect(before.tasks.find((task) => task.id === past.id)).toMatchObject({
    dueDate: today,
    dueTime: '00:00',
    status: 'todo',
  })
  expect(before.tasks.find((task) => task.id === noTime.id)).toMatchObject({
    dueDate: today,
    dueTime: null,
    status: 'todo',
  })
  await page.reload()
  await expect(review.locator(`[data-task-id="${past.id}"]`)).toBeVisible()
  await expect(day.locator(`[data-task-id="${noTime.id}"]`)).toBeVisible()
  await review
    .getByRole('button', {
      name: 'Concluir Compromisso vencido de teste',
      exact: true,
    })
    .click()
  await expect(review).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Nova tarefa', exact: true }),
  ).toBeFocused()
  expect(
    (await readData(page)).tasks.find((task) => task.id === past.id),
  ).toMatchObject({
    dueDate: today,
    dueTime: '00:00',
    status: 'done',
  })
  await expect(day.locator(`[data-task-id="${noTime.id}"]`)).toBeVisible()
  expect(errors).toEqual([])
})

test('marca hábitos de hoje e registra quantidade sem sair do centro de comando', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page
    .getByRole('button', {
      name: 'Marcar Academia como concluído',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', { name: 'Desmarcar Academia', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Registrar Água', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Registrar dia',
    exact: true,
  })
  await expect(dialog.getByLabel('Data', { exact: true })).toHaveValue(
    await localDay(page),
  )
  await dialog.getByLabel(/^Quantidade/).fill('3')
  await expectAxe(page)
  await dialog
    .getByRole('button', { name: 'Salvar registro', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Registrar Água', exact: true }),
  ).toBeFocused()
  const data = await readData(page)
  const academia = data.habits.find((habit) => habit.title === 'Academia')!
  const agua = data.habits.find((habit) => habit.title === 'Água')!
  const today = await localDay(page)
  expect(data.habitLogs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        habitId: academia.id,
        date: today,
        value: 1,
        rest: false,
      }),
      expect.objectContaining({
        habitId: agua.id,
        date: today,
        value: 3,
        rest: false,
      }),
    ]),
  )
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Desmarcar Academia', exact: true }),
  ).toBeVisible()
  expect((await readData(page)).habitLogs).toEqual(data.habitLogs)
  expect(errors).toEqual([])
})

test('compromisso manual persiste em tarefa e backup; edição preserva o registro e conclusão devolve foco', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Adicionar compromisso', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Próximo compromisso',
    exact: true,
  })
  await dialog
    .getByLabel('Nome do compromisso', { exact: true })
    .fill('Reunião de teste')
  await dialog
    .getByLabel('Data do compromisso', { exact: true })
    .fill(await localDay(page, 1))
  await dialog
    .getByLabel('Horário do compromisso', { exact: true })
    .fill('19:30')
  await expectAxe(page)
  await dialog
    .getByRole('button', { name: 'Salvar compromisso', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Reunião de teste',
      exact: true,
    }),
  ).toBeVisible()
  const appointment = (await readData(page)).tasks.find(
    (task) => task.title === 'Reunião de teste',
  )!
  expect(appointment).toMatchObject({
    dueDate: await localDay(page, 1),
    dueTime: '19:30',
    tags: ['compromisso'],
    status: 'todo',
    isExample: false,
  })
  await page
    .getByRole('button', { name: 'Editar compromisso', exact: true })
    .click()
  await dialog
    .getByLabel('Nome do compromisso', { exact: true })
    .fill('Reunião ajustada')
  await dialog
    .getByLabel('Horário do compromisso', { exact: true })
    .fill('20:00')
  await dialog
    .getByRole('button', { name: 'Salvar compromisso', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  const edited = (await readData(page)).tasks.find(
    (task) => task.id === appointment.id,
  )!
  expect(edited).toMatchObject({
    id: appointment.id,
    title: 'Reunião ajustada',
    createdAt: appointment.createdAt,
    dueTime: '20:00',
    tags: ['compromisso'],
    links: appointment.links,
  })
  await page.reload()
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Reunião ajustada',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const downloadPending = page.waitForEvent('download')
  await page
    .getByRole('dialog', { name: 'Seus dados', exact: true })
    .getByRole('button', { name: 'Exportar JSON', exact: true })
    .click()
  const download = await downloadPending
  const path = await download.path()
  if (!path) throw new Error('O backup não foi preparado.')
  const backup = JSON.parse(await readFile(path, 'utf8')) as { data: Snapshot }
  expect(backup.data.tasks.find((task) => task.id === edited.id)).toEqual(
    edited,
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Concluir compromisso', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Adicionar compromisso', exact: true }),
  ).toBeFocused()
  expect(
    (await readData(page)).tasks.find((task) => task.id === appointment.id)
      ?.status,
  ).toBe('done')
  expect(errors).toEqual([])
})

test('meta semanal preserva resultados, une vínculos dos dois lados e calcula progresso sem duplicar', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const before = await readData(page)
  const seedGoal = before.goals.find((goal) => goal.id === 'example-goal')!
  await page.getByRole('button', { name: 'Definir meta', exact: true }).click()
  const selection = page.getByRole('dialog', {
    name: 'Meta da semana',
    exact: true,
  })
  await selection
    .getByRole('combobox', { name: 'Usar meta existente', exact: true })
    .selectOption(seedGoal.id)
  await selection
    .getByRole('button', { name: 'Salvar meta', exact: true })
    .click()
  await expect(selection).not.toBeVisible()
  await page
    .getByRole('button', {
      name: 'Concluir Revisar estruturas de dados',
      exact: true,
    })
    .click()
  await expect(page.locator('#weekly-progress')).toHaveAttribute('value', '33')
  const fourth = await createTask(page, 'Tarefa vinculada de teste')
  await page.getByRole('button', { name: 'Editar meta', exact: true }).click()
  const dialog = page.getByRole('dialog', {
    name: 'Meta da semana',
    exact: true,
  })
  await dialog
    .getByLabel('Nome da meta', { exact: true })
    .fill('Avançar em cloud esta semana')
  await dialog
    .getByLabel('Vincular tarefa', { exact: true })
    .selectOption(fourth.id)
  await dialog
    .getByRole('button', { name: 'Adicionar vínculo', exact: true })
    .click()
  await expect(
    dialog.getByRole('list', { name: 'Tarefas vinculadas', exact: true }),
  ).toContainText(fourth.title)
  await expectAxe(page)
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('#weekly-progress')).toHaveAttribute('value', '25')
  const goal = (await readData(page)).goals.find(
    (item) => item.id === seedGoal.id,
  )!
  expect(goal).toMatchObject({
    id: seedGoal.id,
    title: 'Avançar em cloud esta semana',
    deadline: seedGoal.deadline,
    keyResults: seedGoal.keyResults,
    createdAt: seedGoal.createdAt,
    isExample: false,
  })
  expect(goal.links).toEqual([
    ...seedGoal.links,
    { type: 'tasks', id: fourth.id },
  ])
  await page.reload()
  await expect(page.locator('#weekly-progress')).toHaveAttribute('value', '25')
  expect(
    (await readData(page)).goals.find((item) => item.id === goal.id),
  ).toEqual(goal)
  expect(errors).toEqual([])
})

test('Ctrl+K captura três tipos por Enter, persiste sem duplicar e navega por comando com foco no título', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeFocused()
  const initial = await readData(page)
  for (const input of [
    'Captura de teste hoje 19h #aws !alta',
    'nota: Ideia de teste #pessoal',
    'hábito: Ler teste #leitura',
  ]) {
    const dialog = await openPalette(page)
    await dialog.getByLabel('Capturar ou navegar', { exact: true }).fill(input)
    await dialog
      .getByLabel('Capturar ou navegar', { exact: true })
      .press('Enter')
    await expect(dialog).not.toBeVisible()
    if (input.startsWith('nota:')) {
      await expect(page).toHaveURL(/\/notas\?note=[^&]+&edit=1$/)
      await expect(
        page.getByLabel('Conteúdo Markdown', { exact: true }),
      ).toBeFocused()
      await expect(
        page.getByLabel('Título da nota', { exact: true }),
      ).toHaveValue('Ideia de teste')
    }
  }
  const data = await readData(page)
  expect(data.tasks).toHaveLength(initial.tasks.length + 1)
  expect(data.notes).toHaveLength(initial.notes.length + 1)
  expect(data.habits).toHaveLength(initial.habits.length + 1)
  expect(
    data.tasks.find((task) => task.title === 'Captura de teste'),
  ).toMatchObject({
    dueDate: await localDay(page),
    dueTime: '19:00',
    priority: 'high',
    tags: ['aws'],
    status: 'todo',
    isExample: false,
    repeat: null,
    subtasks: [],
  })
  expect(
    data.notes.find((note) => note.title === 'Ideia de teste'),
  ).toMatchObject({
    content: '',
    tags: ['pessoal'],
    isExample: false,
    links: [],
  })
  expect(
    data.habits.find((habit) => habit.title === 'Ler teste'),
  ).toMatchObject({
    kind: 'binary',
    target: 1,
    timesPerWeek: 7,
    unit: 'vez',
    tags: ['leitura'],
    isExample: false,
    links: [],
  })
  await page.goto('/')
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeFocused()
  expect(await readData(page)).toEqual(data)
  const dialog = await openPalette(page)
  await dialog
    .getByLabel('Capturar ou navegar', { exact: true })
    .fill('/habitos')
  await expect(
    dialog.getByRole('option', { name: 'Ir para Hábitos', exact: true }),
  ).toBeVisible()
  await dialog.getByLabel('Capturar ou navegar', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/\/habitos$/)
  await expect(
    page.getByRole('heading', { name: 'Hábitos', level: 1, exact: true }),
  ).toBeFocused()
  expect(await readData(page)).toEqual(data)
  expect(errors).toEqual([])
})

test('atalhos respeitam digitação e sheets, Escape restaura foco e tabulação fica no diálogo', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeFocused()
  const newTask = page.getByRole('button', { name: 'Nova tarefa', exact: true })
  await newTask.focus()
  await page.keyboard.press('Shift+Slash')
  const help = page.getByRole('dialog', {
    name: 'Atalhos de teclado',
    exact: true,
  })
  await expect(help).toBeVisible()
  await expect(help).toContainText('Ctrl/Cmd + K')
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true)
  }
  await expectAxe(page)
  await page.keyboard.press('Escape')
  await expect(newTask).toBeFocused()
  await newTask.click()
  const taskDialog = page.getByRole('dialog', {
    name: 'Nova tarefa',
    exact: true,
  })
  await page.keyboard.press('Control+k')
  await expect(taskDialog).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(taskDialog.getByLabel('Nome', { exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(newTask).toBeFocused()
  const palette = await openPalette(page)
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(newTask).toBeFocused()
  await page.goto('/tarefas')
  const input = page.getByLabel('Captura rápida', { exact: true })
  await input.fill('Pergunta de teste')
  await input.press('End')
  await input.press('Shift+Slash')
  await expect(input).toHaveValue('Pergunta de teste?')
  await expect(help).not.toBeVisible()
  await expect(palette).not.toBeVisible()
  expect(errors).toEqual([])
})

test('Hoje e captura em 375, 768 e 1280 px, temas, texto 200% e transparência reduzida', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Definir meta', exact: true }).click()
  const selection = page.getByRole('dialog', {
    name: 'Meta da semana',
    exact: true,
  })
  await selection
    .getByRole('combobox', { name: 'Usar meta existente', exact: true })
    .selectOption('example-goal')
  await selection
    .getByRole('button', { name: 'Salvar meta', exact: true })
    .click()
  await expect(selection).not.toBeVisible()
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
    ).toBeFocused()
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expectAxe(page)
      const dialog = await openPalette(page)
      await dialog
        .getByLabel('Capturar ou navegar', { exact: true })
        .fill('Estudar amanhã 19h #faculdade !alta')
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true)
      await expectAxe(page)
      await page.keyboard.press('Escape')
    }
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-5-hoje-${width}.png`),
      fullPage: true,
    })
    const dialog = await openPalette(page)
    await dialog
      .getByLabel('Capturar ou navegar', { exact: true })
      .fill('Estudar amanhã 19h #faculdade !alta')
    await page.screenshot({
      path: evidencePath(`docs/screenshots/etapa-5-palette-${width}.png`),
      fullPage: true,
    })
    await page.keyboard.press('Escape')
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Aparência', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Reduzir transparência', exact: true })
    .check()
  await page.keyboard.press('Escape')
  await expect(page.locator('.toolbar')).toHaveCSS('backdrop-filter', 'none')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const palette = await openPalette(page)
  await palette
    .getByLabel('Capturar ou navegar', { exact: true })
    .fill('nota: Uma ideia com texto ampliado #pessoal')
  expect(
    await palette.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await expect(palette).toHaveCSS('backdrop-filter', 'none')
  await expectAxe(page)
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Adicionar compromisso', exact: true })
    .click()
  const appointment = page.getByRole('dialog', {
    name: 'Próximo compromisso',
    exact: true,
  })
  expect(
    await appointment.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await expect(
    appointment.getByLabel('Nome do compromisso', { exact: true }),
  ).toBeInViewport()
  await expectAxe(page)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Editar meta', exact: true }).click()
  const goal = page.getByRole('dialog', { name: 'Meta da semana', exact: true })
  expect(
    await goal.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await expectAxe(page)
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})
