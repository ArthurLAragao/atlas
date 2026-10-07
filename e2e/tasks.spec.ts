import { evidencePath } from './evidence.js'
import { chooseMenu } from './menu-helpers.js'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import type { Task } from '../src/data/models.js'

test.use({ actionTimeout: 15_000 })

async function readTasks(page: Page): Promise<Task[]> {
  return page.evaluate(
    () =>
      new Promise<Task[]>((resolve, reject) => {
        const request = indexedDB.open('atlas-local')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('tasks', 'readonly')
          const read = transaction.objectStore('tasks').getAll()
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
          transaction.oncomplete = () => {
            database.close()
            resolve(read.result as Task[])
          }
        }
      }),
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

async function quickTask(page: Page, input: string, title = input) {
  await page.getByLabel('Captura rápida', { exact: true }).fill(input)
  await page
    .getByRole('button', { name: 'Adicionar tarefa', exact: true })
    .click()
  await expect
    .poll(async () =>
      (await readTasks(page)).find((task) => task.title === title),
    )
    .toBeTruthy()
  const task = (await readTasks(page)).find((item) => item.title === title)
  if (!task) throw new Error(`A tarefa ${title} não foi salva.`)
  return task
}

function taskRow(page: Page, id: string) {
  return page.locator(`[data-task-id="${id}"]`)
}

async function expectAxe(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([])
}

test('captura em português interpreta prazo, horário, prioridade e tags e persiste após recarregar', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tarefas' }),
  ).toBeFocused()
  const task = await quickTask(
    page,
    'Revisar AWS amanhã 19h #faculdade !alta',
    'Revisar AWS',
  )
  expect(task).toMatchObject({
    dueDate: await localDay(page, 1),
    dueTime: '19:00',
    priority: 'high',
    tags: ['faculdade'],
    status: 'todo',
    isExample: false,
  })
  await page.reload()
  await expect(taskRow(page, task.id)).toBeVisible()
  await expect(
    taskRow(page, task.id).getByRole('button', {
      name: 'Editar Revisar AWS',
      exact: true,
    }),
  ).toHaveAccessibleDescription(/19:00.*Alta.*#faculdade/)
  expect((await readTasks(page)).find((item) => item.id === task.id)).toEqual(
    task,
  )
  const invalidTitle = 'Ler documentação 31/02/2026 25h !urgente'
  const preserved = await quickTask(page, invalidTitle)
  expect(preserved).toMatchObject({
    title: invalidTitle,
    dueDate: null,
    dueTime: null,
    priority: 'medium',
  })
  expect(errors).toEqual([])
})

test('edita detalhes e subtarefas; concluir repetição cria somente uma ocorrência futura', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  const created = await quickTask(page, 'Revisar redes hoje', 'Revisar redes')
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Editar Revisar redes', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Editar tarefa',
    exact: true,
  })
  await dialog.getByLabel('Horário', { exact: true }).fill('18:30')
  await dialog.getByLabel('Prioridade', { exact: true }).selectOption('high')
  await dialog.getByLabel('Contexto', { exact: true }).fill('Cloud pessoal')
  await dialog.getByLabel('Tags', { exact: true }).fill('redes, prática')
  await dialog.getByLabel('Repetição', { exact: true }).selectOption('week')
  await dialog.getByLabel('A cada', { exact: true }).fill('2')
  const subtask = dialog.getByLabel('Nova subtarefa', { exact: true })
  await subtask.fill('Ler o capítulo')
  await subtask.press('Enter')
  await subtask.fill('Resolver exercícios')
  await subtask.press('Enter')
  await dialog
    .getByRole('checkbox', { name: 'Concluir subtarefa 1', exact: true })
    .check()
  await expectAxe(page)
  await dialog
    .getByRole('button', { name: 'Salvar tarefa', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  const edited = (await readTasks(page)).find((task) => task.id === created.id)
  expect(edited).toMatchObject({
    dueTime: '18:30',
    context: 'Cloud pessoal',
    priority: 'high',
    tags: ['redes', 'prática'],
    repeat: { unit: 'week', interval: 2 },
    subtasks: [
      { title: 'Ler o capítulo', done: true },
      { title: 'Resolver exercícios', done: false },
    ],
  })
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Concluir Revisar redes', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await readTasks(page)).filter((task) => task.title === 'Revisar redes')
          .length,
    )
    .toBe(2)
  const future = (await readTasks(page)).find(
    (task) => task.title === 'Revisar redes' && task.id !== created.id,
  )
  expect(future).toMatchObject({
    status: 'todo',
    dueDate: await localDay(page, 14),
    dueTime: '18:30',
    context: 'Cloud pessoal',
    tags: ['redes', 'prática'],
    subtasks: [
      { title: 'Ler o capítulo', done: false },
      { title: 'Resolver exercícios', done: false },
    ],
  })
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Reabrir Revisar redes', exact: true })
    .click()
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Concluir Revisar redes', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await readTasks(page)).find((task) => task.id === created.id)?.status,
    )
    .toBe('done')
  expect(
    (await readTasks(page)).filter((task) => task.title === 'Revisar redes'),
  ).toHaveLength(2)
  await page.reload()
  expect(
    (await readTasks(page)).find((task) => task.id === future?.id),
  ).toEqual(future)
  expect(errors).toEqual([])
})

test('adia para amanhã e restaura uma tarefa excluída com seus detalhes após recarregar', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  const created = await quickTask(
    page,
    'Organizar laboratório hoje',
    'Organizar laboratório',
  )
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Editar Organizar laboratório', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Editar tarefa',
    exact: true,
  })
  await dialog
    .getByRole('button', { name: 'Adiar para amanhã', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect
    .poll(
      async () =>
        (await readTasks(page)).find((task) => task.id === created.id)?.dueDate,
    )
    .toBe(await localDay(page, 1))
  const before = (await readTasks(page)).find((task) => task.id === created.id)
  await taskRow(page, created.id)
    .getByRole('button', { name: 'Editar Organizar laboratório', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Excluir tarefa', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(taskRow(page, created.id)).not.toBeVisible()
  await page.reload()
  await page.getByText('Última exclusão', { exact: true }).click()
  await page
    .getByRole('button', { name: 'Desfazer exclusão', exact: true })
    .first()
    .click()
  await expect(taskRow(page, created.id)).toBeVisible()
  expect(
    (await readTasks(page)).find((task) => task.id === created.id),
  ).toEqual(before)
  expect(errors).toEqual([])
})

test('Kanban move por arrastar e pela situação acessível pelo teclado', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  const created = await quickTask(page, 'Validar quadro')
  await page.getByRole('radio', { name: 'Kanban', exact: true }).check()
  const doing = page.locator('[data-drop-status="doing"]')
  const dragged = taskRow(page, created.id)
  await expect(dragged).toHaveAttribute('draggable', 'true')
  const source = await dragged.locator('.task-grip').boundingBox()
  const destination = await doing.boundingBox()
  if (!source || !destination)
    throw new Error('Alvos de arraste indisponíveis.')
  await dragged.locator('.task-grip').dragTo(doing, {
    targetPosition: {
      x: 20,
      y: Math.max(
        20,
        Math.min(
          destination.height - 20,
          source.y - destination.y + source.height / 2,
        ),
      ),
    },
  })
  await expect
    .poll(
      async () =>
        (await readTasks(page)).find((task) => task.id === created.id)?.status,
    )
    .toBe('doing')
  await expect(doing.locator(`[data-task-id="${created.id}"]`)).toBeVisible()
  const status = taskRow(page, created.id).getByRole('combobox', {
    name: 'Situação de Validar quadro',
    exact: true,
  })
  await expect(status).toBeEnabled()
  await status.focus()
  await expect(status).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'Fazendo', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(
    page.getByRole('option', { name: 'Feito', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect
    .poll(
      async () =>
        (await readTasks(page)).find((task) => task.id === created.id)?.status,
    )
    .toBe('done')
  await expect(status).toBeFocused()
  await expect(
    page
      .locator('[data-drop-status="done"]')
      .locator(`[data-task-id="${created.id}"]`),
  ).toBeVisible()
  await expectAxe(page)
  expect(errors).toEqual([])
})

test('calendário navega com teclado, descobre tarefas sem prazo e cria na data selecionada', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  const noDate = await quickTask(page, 'Planejar sem data')
  await page.getByRole('radio', { name: 'Calendário', exact: true }).check()
  const grid = page.getByRole('grid', { name: /de \d{4}/ })
  await expect(grid.locator('[role="gridcell"]')).toHaveCount(42)
  await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1)
  await grid.locator('button[tabindex="0"]').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused()
  await expect(grid.locator('button[tabindex="0"]')).toHaveAttribute(
    'data-calendar-date',
    await localDay(page, -1),
  )
  await page.keyboard.press('PageDown')
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused()
  await page.getByRole('button', { name: /^Sem prazo \(/ }).click()
  await expect(taskRow(page, noDate.id)).toBeVisible()
  const selected = await localDay(page, 12)
  await page.getByLabel('Selecionar data', { exact: true }).fill(selected)
  await page
    .getByRole('button', { name: 'Nova tarefa neste dia', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Nova tarefa', exact: true })
  await expect(dialog.getByLabel('Prazo', { exact: true })).toHaveValue(
    selected,
  )
  await dialog.getByLabel('Nome', { exact: true }).fill('Entrega no calendário')
  await dialog
    .getByRole('button', { name: 'Criar tarefa', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  const calendarTask = (await readTasks(page)).find(
    (task) => task.title === 'Entrega no calendário',
  )
  expect(calendarTask?.dueDate).toBe(selected)
  if (!calendarTask) throw new Error('A tarefa do calendário não foi salva.')
  await expect(taskRow(page, calendarTask.id)).toBeVisible()
  await expect(
    grid.locator(`[data-calendar-date="${selected}"]`),
  ).toHaveAccessibleName(/1 tarefa$/)
  await expectAxe(page)
  expect(errors).toEqual([])
})

test('contextos editáveis persistem e valores literais all e none funcionam como filtros', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  await page
    .getByRole('button', { name: 'Editar contextos', exact: true })
    .click()
  const contexts = page.getByRole('dialog', {
    name: 'Editar contextos',
    exact: true,
  })
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    'Editar contextos',
  )
  await contexts
    .getByRole('textbox', { name: 'Um contexto por linha', exact: true })
    .fill('Faculdade\nCloud pessoal\nall\nnone')
  await contexts
    .getByRole('button', { name: 'Salvar contextos', exact: true })
    .click()
  await expect(contexts).not.toBeVisible()
  for (const context of ['all', 'none']) {
    const task = await quickTask(page, `Contexto literal ${context}`)
    await taskRow(page, task.id)
      .getByRole('button', {
        name: `Editar Contexto literal ${context}`,
        exact: true,
      })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Editar tarefa',
      exact: true,
    })
    await dialog.getByLabel('Contexto', { exact: true }).fill(context)
    await dialog
      .getByRole('button', { name: 'Salvar tarefa', exact: true })
      .click()
    await expect(dialog).not.toBeVisible()
  }
  await page.reload()
  const filter = page.getByRole('combobox', {
    name: 'Filtrar contexto',
    exact: true,
  })
  for (const context of ['all', 'none']) {
    await chooseMenu(page, filter, context)
    await expect(
      page.getByRole('button', {
        name: `Editar Contexto literal ${context}`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('[data-task-id]')).toHaveCount(1)
  }
  await chooseMenu(page, filter, 'Todos os contextos')
  await page.getByLabel('Buscar tarefas', { exact: true }).fill('literal all')
  await expect(page.locator('[data-task-id]')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'Editar contextos', exact: true })
    .click()
  await expect(
    contexts.getByRole('textbox', {
      name: 'Um contexto por linha',
      exact: true,
    }),
  ).toHaveValue('Faculdade\nCloud pessoal\nall\nnone')
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('três visões em 375, 768 e 1280 px, temas, contraste, alvos e texto 200%', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const views = [
    ['Lista', 'lista'],
    ['Kanban', 'kanban'],
    ['Calendário', 'calendario'],
  ] as const
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tarefas')
    for (const [name, slug] of views) {
      await page.getByRole('radio', { name, exact: true }).check()
      await expect(page.getByText(/Abrindo (Kanban|calendário)\./)).toHaveCount(
        0,
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      expect(
        await page
          .locator('.task-check, .task-name, .task-status, .task-calendar-day')
          .evaluateAll((controls) =>
            controls.every((control) => {
              const rect = control.getBoundingClientRect()
              return rect.width >= 44 && rect.height >= 44
            }),
          ),
      ).toBe(true)
      for (const theme of ['Claro', 'Escuro']) {
        await page
          .getByRole('button', { name: 'Aparência', exact: true })
          .click()
        await page.getByRole('radio', { name: theme, exact: true }).check()
        await page.keyboard.press('Escape')
        await expectAxe(page)
      }
      await page.screenshot({
        path: evidencePath(`docs/screenshots/etapa-4-${slug}-${width}.png`),
        fullPage: true,
      })
    }
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  for (const [name] of views) {
    await page.getByRole('radio', { name, exact: true }).check()
    await expect(page.getByText(/Abrindo (Kanban|calendário)\./)).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await page.getByRole('button', { name: 'Nova tarefa', exact: true }).focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Nova tarefa', exact: true })
  await expect(dialog.getByLabel('Nome', { exact: true })).toBeInViewport()
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true)
  }
  await expectAxe(page)
  await dialog.getByLabel('Nome', { exact: true }).focus()
  await page.screenshot({
    path: evidencePath('docs/screenshots/etapa-4-texto-200.png'),
    fullPage: false,
  })
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Nova tarefa', exact: true }),
  ).toBeFocused()
  expect(errors).toEqual([])
})

test('listas de 210 tarefas virtualizam e mantêm Home e End por teclado nas três visões', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/tarefas')
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await panel
    .getByRole('button', { name: 'Remover exemplos (20)', exact: true })
    .click()
  await expect(
    panel.getByText('0 registros salvos localmente', { exact: true }),
  ).toBeVisible()
  const now = new Date().toISOString()
  const tasks: Task[] = Array.from({ length: 210 }, (_, index) => ({
    id: `personal-task-${String(index).padStart(3, '0')}`,
    title: `Tarefa ${String(index + 1).padStart(3, '0')}`,
    tags: ['teste'],
    links: [],
    createdAt: now,
    updatedAt: now,
    isExample: false,
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    dueTime: null,
    context: null,
    subtasks: [],
    repeat: null,
    focusMinutes: 0,
  }))
  await panel.getByLabel('Arquivo para importar').setInputFiles({
    name: 'tarefas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'atlas',
        schemaVersion: 1,
        exportedAt: now,
        data: {
          tasks,
          habits: [],
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
  for (const view of ['Lista', 'Kanban', 'Calendário']) {
    await page.getByRole('radio', { name: view, exact: true }).check()
    if (view === 'Calendário')
      await page.getByRole('button', { name: /^Sem prazo \(/ }).click()
    const list = page.getByTestId('task-list')
    const rows = list.locator('[data-task-index]')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeLessThan(200)
    const first = list.getByRole('button', {
      name: 'Editar Tarefa 001',
      exact: true,
    })
    await first.focus()
    await page.keyboard.press('End')
    await expect(
      list.getByRole('button', { name: 'Editar Tarefa 210', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Home')
    await expect(first).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(
      list.getByRole('button', { name: 'Editar Tarefa 002', exact: true }),
    ).toBeFocused()
    expect(await rows.count()).toBeLessThan(200)
  }
  await expectAxe(page)
  expect(errors).toEqual([])
})
