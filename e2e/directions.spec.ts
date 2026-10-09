import { evidencePath } from './evidence.js'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  collections,
  snapshotSchema,
  type Goal,
  type Project,
  type Snapshot,
} from '../src/data/models.js'

// Playwright owns fresh, disposable contexts. No test attaches to the user's
// current tab or personal IndexedDB database.
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

async function day(page: Page, offset = 0): Promise<string> {
  return page.evaluate((days) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
  }, offset)
}

async function openList(page: Page) {
  await page.goto('/metas')
  await expect(
    page.getByRole('heading', {
      name: 'Metas e projetos',
      level: 1,
      exact: true,
    }),
  ).toBeVisible()
}

async function openHome(page: Page) {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', level: 1, exact: true }),
  ).toBeVisible()
}

async function createGoal(
  page: Page,
  title: string,
  options: {
    deadline?: string
    weekly?: boolean
    description?: string
    tags?: string
    results?: {
      title: string
      current: number
      target: number
      unit?: string
    }[]
  } = {},
): Promise<Goal> {
  await openList(page)
  await page.getByRole('button', { name: 'Nova meta', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova meta', exact: true })
  await expect(
    dialog.getByLabel('Título da meta', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Título da meta', { exact: true }).fill(title)
  if (options.deadline)
    await dialog
      .getByLabel('Prazo da meta', { exact: true })
      .fill(options.deadline)
  if (options.weekly)
    await dialog
      .getByRole('checkbox', {
        name: 'Definir como meta da semana',
        exact: true,
      })
      .check()
  if (options.description || options.tags) {
    await dialog
      .locator('summary')
      .filter({ hasText: 'Descrição e tags' })
      .click()
    if (options.description)
      await dialog
        .getByLabel('Descrição da meta', { exact: true })
        .fill(options.description)
    if (options.tags)
      await dialog
        .getByLabel('Tags da meta', { exact: true })
        .fill(options.tags)
  }
  for (const [index, result] of (options.results ?? []).entries()) {
    await dialog
      .getByRole('button', { name: 'Adicionar resultado-chave', exact: true })
      .click()
    await dialog
      .getByLabel(`Título do resultado ${index + 1}`, { exact: true })
      .fill(result.title)
    await dialog
      .getByLabel(`Valor atual ${index + 1}`, { exact: true })
      .fill(String(result.current))
    await dialog
      .getByLabel(`Valor-alvo ${index + 1}`, { exact: true })
      .fill(String(result.target))
    if (result.unit)
      await dialog
        .getByLabel(`Unidade ${index + 1}`, { exact: true })
        .fill(result.unit)
  }
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('heading', { name: title, exact: true, level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: title, exact: true, level: 1 }),
  ).toBeFocused()
  const result = (await readData(page)).goals.find(
    (goal) => goal.title === title,
  )
  if (!result) throw new Error(`Meta ${title} não foi persistida.`)
  await expect(page).toHaveURL(new RegExp(`/metas\\?goal=${result.id}$`))
  return result
}

async function createProject(page: Page, title: string): Promise<Project> {
  await openList(page)
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo projeto', exact: true })
  await expect(
    dialog.getByLabel('Título do projeto', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Título do projeto', { exact: true }).fill(title)
  await dialog
    .getByLabel('Descrição do projeto', { exact: true })
    .fill(
      'Um projeto pequeno para transformar uma intenção em trabalho concreto.',
    )
  await dialog.locator('summary').filter({ hasText: 'Tags e links' }).click()
  await dialog
    .getByLabel('Tags do projeto', { exact: true })
    .fill('projetos, software')
  await dialog
    .getByLabel('URL do repositório', { exact: true })
    .fill('https://example.com/repositorio/atlas')
  await dialog
    .getByRole('button', { name: 'Adicionar link', exact: true })
    .click()
  await dialog
    .getByLabel('Título do link 1', { exact: true })
    .fill('Documentação do projeto')
  await dialog
    .getByLabel('URL do link 1', { exact: true })
    .fill('https://example.com/atlas/documentacao')
  await dialog
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  const result = (await readData(page)).projects.find(
    (project) => project.title === title,
  )
  if (!result) throw new Error(`Projeto ${title} não foi persistido.`)
  await expect(page).toHaveURL(new RegExp(`/metas\\?project=${result.id}$`))
  await expect(
    page.getByRole('heading', { name: title, exact: true, level: 1 }),
  ).toBeFocused()
  return result
}

async function relate(
  page: Page,
  kind: 'tarefa' | 'nota' | 'meta' | 'projeto',
  id: string,
) {
  await page
    .getByRole('button', { name: `Vincular ${kind}`, exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: `Vincular ${kind}`,
    exact: true,
  })
  await dialog
    .getByRole('combobox', { name: `Escolher ${kind}`, exact: true })
    .selectOption(id)
  await dialog.getByRole('button', { name: 'Vincular', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

function related(page: Page, title: string) {
  return page.getByRole('link').filter({ hasText: title }).first()
}

function weeklySection(page: Page) {
  return page.getByRole('region', { name: 'Meta da semana', exact: true })
}

async function undo(page: Page) {
  const button = page.getByRole('button', { name: /^Desfazer:/ })
  if (!(await button.isVisible()))
    await page
      .getByText('Última ação em metas e projetos', { exact: true })
      .click()
  await expect(button).toBeVisible()
  await button.click()
  const restored = page.getByRole('link', {
    name: 'Abrir registro recuperado',
    exact: true,
  })
  await expect(restored).toBeFocused()
  await restored.click()
}

async function noOverflow(page: Page, scope?: Locator) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  if (scope)
    expect(
      await scope.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true)
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

function expectRecoveredData(before: Snapshot, after: Snapshot) {
  for (const name of collections) {
    const stripVersion = (records: Snapshot[typeof name]) =>
      records.map((record) => ({ ...record, updatedAt: '' }))
    expect(stripVersion(after[name])).toEqual(stripVersion(before[name]))
    for (const record of after[name]) {
      const previous = before[name].find((item) => item.id === record.id)
      expect(previous).toBeTruthy()
      expect(Date.parse(record.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(previous!.updatedAt),
      )
    }
  }
}

test('meta com resultados manuais preserva 3/10 e 8/30 quando tarefas vinculadas são concluídas', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openHome(page)
  const initial = await readData(page)
  const task = initial.tasks[0]!
  const goal = await createGoal(page, 'Concluir trilha AWS', {
    deadline: await day(page, 7),
    weekly: true,
    description: 'Aprender fundamentos de AWS com exercícios e prática.',
    tags: 'aws, estudos',
    results: [
      { title: 'Completar módulos', current: 3, target: 10, unit: 'módulos' },
      { title: 'Horas de estudo', current: 8, target: 30, unit: 'h' },
    ],
  })
  const manual = goal.keyResults
  expect(goal.description).toBe(
    'Aprender fundamentos de AWS com exercícios e prática.',
  )
  expect(goal.tags).toEqual(['aws', 'estudos'])
  await expect(
    page.getByRole('progressbar', {
      name: 'Progresso dos resultados-chave',
      exact: true,
    }),
  ).toHaveAttribute('value', '28')
  await expect(
    page.getByRole('progressbar', {
      name: 'Progresso de Completar módulos',
      exact: true,
    }),
  ).toHaveAttribute('value', '30')
  await expect(
    page.getByRole('progressbar', {
      name: 'Progresso de Horas de estudo',
      exact: true,
    }),
  ).toHaveAttribute('value', '27')
  await expect(page.getByText('28%', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Faltam 7 dias/)).toBeVisible()
  await relate(page, 'tarefa', task.id)
  await expect(related(page, task.title)).toBeVisible()
  await related(page, task.title).click()
  await expect(page).toHaveURL(/\/tarefas/)
  const taskDialog = page.getByRole('dialog', {
    name: 'Editar tarefa',
    exact: true,
  })
  await expect(taskDialog.getByLabel('Nome', { exact: true })).toHaveValue(
    task.title,
  )
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: `Concluir ${task.title}`, exact: true })
    .click()
  // A full navigation must follow the committed record, not optimistic paint.
  await expect
    .poll(
      async () =>
        (await readData(page)).tasks.find((item) => item.id === task.id)
          ?.status,
    )
    .toBe('done')
  await page.goto(`/metas?goal=${goal.id}`)
  await expect(page.getByText('28%', { exact: true }).first()).toBeVisible()
  const saved = (await readData(page)).goals.find(
    (item) => item.id === goal.id,
  )!
  expect(saved.keyResults).toEqual(manual)
  await expect(page.getByText(/1 de 1 tarefas/)).toBeVisible()
  await expect(
    page.getByRole('progressbar', {
      name: 'Progresso por tarefas vinculadas',
      exact: true,
    }),
  ).toHaveAttribute('value', '100')
  await page.getByRole('button', { name: 'Editar meta', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar meta', exact: true })
  await dialog.getByLabel('Valor atual 1', { exact: true }).fill('5')
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('38%', { exact: true }).first()).toBeVisible()
  await page.reload()
  expect(
    (await readData(page)).goals
      .find((item) => item.id === goal.id)
      ?.keyResults.map((item) => item.current),
  ).toEqual([5, 8])
  await page.goto('/')
  await expect(weeklySection(page)).toContainText(goal.title)
  expect(errors).toEqual([])
})

test('Hoje exige escolha semanal explícita e substitui a escolha anterior sem inferir pelo prazo', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(weeklySection(page)).toContainText(/Defina|Escolha/)
  const first = await createGoal(page, 'Meta com prazo sem escolha semanal', {
    deadline: await day(page, 2),
  })
  await page.goto('/')
  await expect(weeklySection(page)).not.toContainText(first.title)
  await page.goto(`/metas?goal=${first.id}`)
  await page.getByRole('button', { name: 'Editar meta', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar meta', exact: true })
  await dialog
    .getByRole('checkbox', { name: 'Definir como meta da semana', exact: true })
    .check()
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.goto('/')
  await expect(weeklySection(page)).toContainText(first.title)
  const second = await createGoal(page, 'Direção escolhida nesta semana', {
    weekly: true,
  })
  const data = await readData(page)
  expect(
    data.goals.filter((goal) => goal.weekly).map((goal) => goal.id),
  ).toEqual([second.id])
  await page.goto('/')
  await expect(weeklySection(page)).toContainText(second.title)
  await expect(weeklySection(page)).not.toContainText(first.title)
  await page.goto(`/metas?goal=${second.id}`)
  await page.getByRole('button', { name: 'Arquivar meta', exact: true }).click()
  await page.goto('/')
  await expect(weeklySection(page)).not.toContainText(second.title)
  await expect(weeklySection(page)).toContainText(/Defina|Escolha/)
  expect(errors).toEqual([])
})

test('projeto reúne tarefas, notas e metas existentes e cria registros já vinculados sem duplicar conteúdo', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openHome(page)
  const initial = await readData(page)
  const task = initial.tasks[0]!
  const note = initial.notes[0]!
  const goal = await createGoal(page, 'Publicar primeira versão do projeto')
  const project = await createProject(page, 'Atlas em pequenas entregas')
  await relate(page, 'tarefa', task.id)
  await relate(page, 'nota', note.id)
  await relate(page, 'meta', goal.id)
  await expect(related(page, task.title)).toBeVisible()
  await expect(related(page, note.title)).toBeVisible()
  await expect(related(page, goal.title)).toBeVisible()
  await page
    .locator('summary')
    .filter({ hasText: 'Descrição, tags e links' })
    .click()
  await expect(
    page.getByRole('link', { name: 'Abrir repositório', exact: true }),
  ).toHaveAttribute('href', project.repositoryUrl!)
  await expect(
    page.getByRole('link', { name: 'Documentação do projeto', exact: true }),
  ).toHaveAttribute('href', 'https://example.com/atlas/documentacao')
  await related(page, goal.title).click()
  await expect(page).toHaveURL(`/metas?goal=${goal.id}`)
  await expect(related(page, project.title)).toBeVisible()
  await related(page, project.title).click()
  await expect(page).toHaveURL(`/metas?project=${project.id}`)
  await related(page, note.title).click()
  await expect(page).toHaveURL(new RegExp(`/notas\\?note=${note.id}`))
  await expect(
    page.getByRole('heading', { name: note.title, exact: true, level: 1 }),
  ).toBeVisible()
  await page.goto(`/metas?project=${project.id}`)
  await page
    .getByRole('button', { name: 'Criar tarefa neste projeto', exact: true })
    .click()
  const taskDialog = page.getByRole('dialog', {
    name: 'Nova tarefa no projeto',
    exact: true,
  })
  await taskDialog
    .getByLabel('Título da tarefa', { exact: true })
    .fill('Preparar release pequena')
  await taskDialog
    .getByRole('button', { name: 'Criar tarefa', exact: true })
    .click()
  await expect(taskDialog).not.toBeVisible()
  await expect(related(page, 'Preparar release pequena')).toBeVisible()
  await page
    .getByRole('button', { name: 'Criar nota neste projeto', exact: true })
    .click()
  const noteDialog = page.getByRole('dialog', {
    name: 'Nova nota no projeto',
    exact: true,
  })
  await noteDialog
    .getByLabel('Título da nota', { exact: true })
    .fill('Decisões da release')
  await noteDialog
    .getByRole('button', { name: 'Criar nota', exact: true })
    .click()
  await expect(noteDialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/notas\?note=[^&]+&edit=1$/)
  await expect(
    page.getByLabel('Conteúdo Markdown', { exact: true }),
  ).toBeFocused()
  await page
    .getByLabel('Conteúdo Markdown', { exact: true })
    .fill('Uma nota vinculada por ID, com texto próprio.')
  await page.getByRole('button', { name: 'Salvar nota', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Salvar nota', exact: true }),
  ).toBeDisabled()
  const data = await readData(page)
  expect(data.notes.filter((item) => item.title === note.title)).toHaveLength(1)
  expect(
    data.notes.filter((item) => item.title === 'Decisões da release'),
  ).toHaveLength(1)
  expect(data.tasks.filter((item) => item.title === task.title)).toHaveLength(1)
  expect(
    data.notes.find((item) => item.title === 'Decisões da release')?.links,
  ).toContainEqual({ type: 'projects', id: project.id })
  expect(
    data.tasks.find((item) => item.title === 'Preparar release pequena')?.links,
  ).toContainEqual({ type: 'projects', id: project.id })
  await page.goto(`/metas?project=${project.id}`)
  await page.reload()
  for (const title of [
    task.title,
    note.title,
    goal.title,
    'Preparar release pequena',
    'Decisões da release',
  ])
    await expect(related(page, title)).toBeVisible()
  await axe(page)
  expect(errors).toEqual([])
})

test('exclusão remove referências e desfazer persistente restaura meta, projeto e todas as relações', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const goal = await createGoal(page, 'Meta para recuperar', { weekly: true })
  const project = await createProject(page, 'Projeto para recuperar')
  const initial = await readData(page)
  await relate(page, 'tarefa', initial.tasks[0]!.id)
  await relate(page, 'nota', initial.notes[0]!.id)
  await relate(page, 'meta', goal.id)
  const beforeProject = await readData(page)
  await page
    .getByRole('button', { name: 'Excluir projeto', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Metas e projetos',
      exact: true,
      level: 1,
    }),
  ).toBeFocused()
  const deletedProject = await readData(page)
  expect(deletedProject.projects.some((item) => item.id === project.id)).toBe(
    false,
  )
  for (const items of collections.map((name) => deletedProject[name]))
    for (const item of items)
      expect(item.links.some((link) => link.id === project.id)).toBe(false)
  await page.reload()
  await undo(page)
  await expect(page).toHaveURL(`/metas?project=${project.id}`)
  await expect(
    page.getByRole('heading', { name: project.title, exact: true, level: 1 }),
  ).toBeFocused()
  const restoredProject = await readData(page)
  expectRecoveredData(beforeProject, restoredProject)
  await related(page, goal.title).click()
  const beforeGoal = await readData(page)
  await page.getByRole('button', { name: 'Excluir meta', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  const deletedGoal = await readData(page)
  expect(deletedGoal.goals.some((item) => item.id === goal.id)).toBe(false)
  for (const items of collections.map((name) => deletedGoal[name]))
    for (const item of items)
      expect(item.links.some((link) => link.id === goal.id)).toBe(false)
  await undo(page)
  await expect(page).toHaveURL(`/metas?goal=${goal.id}`)
  const restoredGoal = await readData(page)
  expectRecoveredData(beforeGoal, restoredGoal)
  await page.getByRole('button', { name: 'Arquivar meta', exact: true }).click()
  expect(
    (await readData(page)).goals.find((item) => item.id === goal.id)?.status,
  ).toBe('archived')
  await undo(page)
  expect(
    (await readData(page)).goals.find((item) => item.id === goal.id)?.status,
  ).toBe('active')
  expect(errors).toEqual([])
})

test('prazo comunica dias de calendário, atraso e conclusão; arquivar projeto preserva estado anterior', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('/')
  const goal = await createGoal(page, 'Prazo compreensível', {
    deadline: await day(page, -2),
    results: [
      {
        title: 'Quantidade precisa',
        current: 0.0001,
        target: 0.001,
        unit: 'unidade',
      },
    ],
  })
  await expect(page.getByText(/0,0001 \/ 0,001/)).toBeVisible()
  await expect(
    page.getByText(/Vencida há 2 dias|Venceu há 2 dias/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Editar meta', exact: true }).click()
  const goalDialog = page.getByRole('dialog', {
    name: 'Editar meta',
    exact: true,
  })
  await goalDialog
    .getByRole('combobox', { name: 'Estado da meta', exact: true })
    .selectOption('completed')
  await goalDialog
    .getByRole('button', { name: 'Salvar meta', exact: true })
    .click()
  await expect(goalDialog).not.toBeVisible()
  await expect(
    page.getByText('Concluída', { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText(/Vencida há|Venceu há/)).toHaveCount(0)
  expect(
    (await readData(page)).goals.find((item) => item.id === goal.id)?.status,
  ).toBe('completed')
  const project = await createProject(page, 'Projeto pausado')
  await page
    .getByRole('button', { name: 'Editar projeto', exact: true })
    .click()
  const projectDialog = page.getByRole('dialog', {
    name: 'Editar projeto',
    exact: true,
  })
  await projectDialog
    .getByRole('combobox', { name: 'Estado do projeto', exact: true })
    .selectOption('paused')
  await projectDialog
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click()
  await expect(projectDialog).not.toBeVisible()
  await expect(page.getByText('Pausado', { exact: true }).first()).toBeVisible()
  await page
    .getByRole('button', { name: 'Arquivar projeto', exact: true })
    .click()
  expect(
    (await readData(page)).projects.find((item) => item.id === project.id),
  ).toMatchObject({ status: 'archived', archivedFrom: 'paused' })
  await undo(page)
  expect(
    (await readData(page)).projects.find((item) => item.id === project.id)
      ?.status,
  ).toBe('paused')
  expect(errors).toEqual([])
})

test('criação, resultados-chave, cancelamento e manutenção mantêm foco e operam somente pelo teclado', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  const trigger = page.getByRole('button', { name: 'Nova meta', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  let dialog = page.getByRole('dialog', { name: 'Nova meta', exact: true })
  await expect(
    dialog.getByLabel('Título da meta', { exact: true }),
  ).toBeFocused()
  await page.keyboard.type('Intenção capturada pelo teclado')
  await page.keyboard.press('Shift+Tab')
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(
    (await readData(page)).goals.some(
      (item) => item.title === 'Intenção capturada pelo teclado',
    ),
  ).toBe(false)
  await page.keyboard.press('Enter')
  dialog = page.getByRole('dialog', { name: 'Nova meta', exact: true })
  await page.keyboard.type('Meta criada sem mouse')
  const add = dialog.getByRole('button', {
    name: 'Adicionar resultado-chave',
    exact: true,
  })
  for (
    let count = 0;
    count < 35 &&
    !(await add.evaluate((element) => element === document.activeElement));
    count += 1
  )
    await page.keyboard.press('Tab')
  await expect(add).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    dialog.getByLabel('Título do resultado 1', { exact: true }),
  ).toBeFocused()
  await page.keyboard.type('Ler capítulos')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('1')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('4')
  const save = dialog.getByRole('button', { name: 'Salvar meta', exact: true })
  for (
    let count = 0;
    count < 35 &&
    !(await save.evaluate((element) => element === document.activeElement));
    count += 1
  )
    await page.keyboard.press('Tab')
  await expect(save).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).not.toBeVisible()
  const heading = page.getByRole('heading', {
    name: 'Meta criada sem mouse',
    exact: true,
    level: 1,
  })
  await expect(heading).toBeFocused()
  await expect(page.getByText('25%', { exact: true }).first()).toBeVisible()
  const edit = page.getByRole('button', { name: 'Editar meta', exact: true })
  for (
    let count = 0;
    count < 35 &&
    !(await edit.evaluate((element) => element === document.activeElement));
    count += 1
  )
    await page.keyboard.press('Tab')
  await expect(edit).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  await page.getByRole('button', { name: 'Arquivar meta', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Desarquivar meta', exact: true }),
  ).toBeFocused()
  const undoButton = page.getByRole('button', { name: /^Desfazer:/ })
  await undoButton.focus()
  await page.keyboard.press('Enter')
  const recovered = page.getByRole('link', {
    name: 'Abrir registro recuperado',
    exact: true,
  })
  await expect(recovered).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(heading).toBeFocused()
  await page.getByRole('button', { name: 'Excluir meta', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancelar', exact: true }),
  ).toBeFocused()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .press('Enter')
  await expect(
    page.getByRole('heading', {
      name: 'Metas e projetos',
      exact: true,
      level: 1,
    }),
  ).toBeFocused()
  await undoButton.focus()
  await page.keyboard.press('Enter')
  await expect(recovered).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(heading).toBeFocused()
  await axe(page)
  expect(errors).toEqual([])
})

test('metas e projetos conservam leitura, campos e barras em 375/768/1280 px, dois temas e texto 200%', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const errors = watchErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const goal = await createGoal(
    page,
    'Aprender com constância e transformar estudos em projetos úteis',
    {
      deadline: await day(page, 12),
      tags: 't'.repeat(60),
      results: [
        {
          title: 'm'.repeat(240),
          current: 3,
          target: 10,
          unit: 'u'.repeat(40),
        },
        {
          title: 'Registrar horas de estudo com prática e revisão',
          current: 8,
          target: 30,
          unit: 'h',
        },
      ],
    },
  )
  const project = await createProject(
    page,
    'Construir uma pequena aplicação e documentar as decisões de produto',
  )
  await relate(page, 'meta', goal.id)
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      for (const [kind, item] of [
        ['goal', goal],
        ['project', project],
      ] as const) {
        await page.goto(`/metas?${kind}=${item.id}`)
        await expect(
          page.getByRole('heading', {
            name: item.title,
            level: 1,
            exact: true,
          }),
        ).toBeVisible()
        await page
          .locator('summary')
          .filter({ hasText: 'Descrição, tags e links' })
          .click()
        await expect(page.locator('.direction-detail')).toHaveCSS(
          'backdrop-filter',
          'none',
        )
        await noOverflow(page)
        await axe(page)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: evidencePath(
            `docs/screenshots/etapa-7a-${kind}-${width}-${theme.toLowerCase()}.png`,
          ),
        })
        const label = kind === 'goal' ? 'meta' : 'projeto'
        await page
          .getByRole('button', { name: `Editar ${label}`, exact: true })
          .click()
        const dialog = page.getByRole('dialog', {
          name: `Editar ${label}`,
          exact: true,
        })
        await noOverflow(page, dialog)
        await axe(page)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
        await noOverflow(page, dialog)
        await axe(page)
        await expect(
          dialog.getByLabel(
            `Título ${kind === 'goal' ? 'da meta' : 'do projeto'}`,
            { exact: true },
          ),
        ).toBeVisible()
        await page.screenshot({
          path: evidencePath(
            `docs/screenshots/etapa-7a-sheet-${kind}-${width}-${theme.toLowerCase()}-200.png`,
          ),
        })
        const saveButton = dialog.getByRole('button', {
          name: `Salvar ${label}`,
          exact: true,
        })
        await saveButton.scrollIntoViewIfNeeded()
        await expect(saveButton).toBeVisible()
        await saveButton.focus()
        await page.keyboard.press('Enter')
        await expect(dialog).not.toBeVisible()
        await noOverflow(page)
        await axe(page)
        await page.screenshot({
          path: evidencePath(
            `docs/screenshots/etapa-7a-texto-${kind}-${width}-${theme.toLowerCase()}-200.png`,
          ),
        })
        await page.evaluate(() => {
          document.documentElement.style.fontSize = ''
        })
      }
      await openList(page)
      await noOverflow(page)
      await axe(page)
    }
  }
  expect(errors).toEqual([])
})

test('exemplos incluem Atlas e AWS/DevOps, são removíveis e não reaparecem após recarregar', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  const initial = await readData(page)
  expect(
    initial.projects
      .filter((project) => project.isExample)
      .some((project) => /^Atlas$/iu.test(project.title)),
  ).toBe(true)
  expect(
    initial.projects
      .filter((project) => project.isExample)
      .some((project) => /AWS.*DevOps|DevOps.*AWS/iu.test(project.title)),
  ).toBe(true)
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await dialog
    .getByRole('button', { name: /^Remover exemplos \(\d+\)$/ })
    .click()
  await expect
    .poll(async () =>
      Object.values(await readData(page)).every((items) =>
        Array.isArray(items) ? items.length === 0 : items === null,
      ),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await page.reload()
  expect(
    Object.values(await readData(page)).every((items) =>
      Array.isArray(items) ? items.length === 0 : items === null,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  await dialog
    .getByRole('button', { name: 'Desfazer remoção', exact: true })
    .click()
  const restored = await readData(page)
  for (const name of collections) expect(restored[name]).toEqual(initial[name])
  expect(errors).toEqual([])
})

test('lista de 210 metas preserva teclado e posição na lista ao virtualizar registros', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  const initial = await readData(page)
  const timestamp = new Date().toISOString()
  const goals: Goal[] = Array.from({ length: 210 }, (_, index) => ({
    id: `virtual-goal-${index}`,
    title: `Meta virtual ${String(index + 1).padStart(3, '0')}`,
    deadline: null,
    keyResults: [],
    status: 'active',
    weekly: false,
    tags: ['virtual'],
    links: [],
    isExample: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await dialog
    .getByLabel('Arquivo para importar', { exact: true })
    .setInputFiles({
      name: 'metas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'atlas',
          schemaVersion: 1,
          exportedAt: timestamp,
          data: { ...initial, goals: [...initial.goals, ...goals] },
        }),
      ),
    })
  await dialog
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(dialog.locator('.import-preview')).not.toBeVisible()
  await page.keyboard.press('Escape')
  await page
    .getByLabel('Buscar metas e projetos', { exact: true })
    .fill('virtual')
  const list = page.getByRole('list', {
    name: 'Metas encontradas',
    exact: true,
  })
  expect(await list.getByRole('listitem').count()).toBeLessThan(210)
  const first = list.getByRole('link').filter({ hasText: 'Meta virtual 001' })
  await first.focus()
  await page.keyboard.press('End')
  const last = list.getByRole('link').filter({ hasText: 'Meta virtual 210' })
  await expect(last).toBeFocused()
  await expect(last.locator('..').locator('..')).toHaveAttribute(
    'aria-posinset',
    '210',
  )
  await page.keyboard.press('ArrowUp')
  await expect(
    list.getByRole('link').filter({ hasText: 'Meta virtual 209' }),
  ).toBeFocused()
  await page.keyboard.press('Home')
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', {
      name: 'Meta virtual 001',
      level: 1,
      exact: true,
    }),
  ).toBeFocused()
  expect(errors).toEqual([])
})

test('URL inválida mantém o formulário recuperável e não grava projeto parcial', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo projeto', exact: true })
  await dialog
    .getByLabel('Título do projeto', { exact: true })
    .fill('Projeto com URL validada')
  await dialog.locator('summary').filter({ hasText: 'Tags e links' }).click()
  const url = dialog.getByLabel('URL do repositório', { exact: true })
  await url.fill('https://')
  expect(
    await url.evaluate(
      (element) =>
        element instanceof HTMLInputElement && !element.checkValidity(),
    ),
  ).toBe(true)
  // Exercise application validation too: native browser validation alone must
  // not be the only layer protecting repository writes from malformed URLs.
  await dialog.locator('form').evaluate((form) => {
    if (!(form instanceof HTMLFormElement))
      throw new Error('O editor precisa ser um formulário.')
    form.noValidate = true
  })
  await dialog
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('alert')).toContainText('URLs precisam começar')
  expect(
    (await readData(page)).projects.some(
      (project) => project.title === 'Projeto com URL validada',
    ),
  ).toBe(false)
  await expect(
    dialog.getByLabel('Título do projeto', { exact: true }),
  ).toHaveValue('Projeto com URL validada')
  await url.fill('https://example.com/projeto')
  await dialog
    .getByRole('button', { name: 'Salvar projeto', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  expect(
    (await readData(page)).projects.find(
      (project) => project.title === 'Projeto com URL validada',
    )?.repositoryUrl,
  ).toBe('https://example.com/projeto')
  expect(errors).toEqual([])
})

test('selecionar meta existente no Hoje preserva prazo vazio, descrição, estado e resultados manuais', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const goal = await createGoal(page, 'Aprender sem prazo artificial', {
    description: 'Uma intenção com ritmo próprio e medidas manuais.',
    tags: 'estudos, conhecimento',
    results: [
      { title: 'Módulos concluídos', current: 3, target: 10, unit: 'módulos' },
    ],
  })
  await page.goto('/')
  await weeklySection(page)
    .getByRole('button', { name: 'Definir meta', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Meta da semana',
    exact: true,
  })
  await dialog
    .getByRole('combobox', { name: 'Usar meta existente', exact: true })
    .selectOption(goal.id)
  await expect(dialog.getByLabel('Nome da meta', { exact: true })).toHaveValue(
    goal.title,
  )
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const selected = (await readData(page)).goals.find(
    (item) => item.id === goal.id,
  )!
  expect(selected).toMatchObject({
    title: goal.title,
    deadline: null,
    description: goal.description,
    status: goal.status,
    keyResults: goal.keyResults,
    weekly: true,
  })
  expect(selected.tags).toEqual(expect.arrayContaining(goal.tags))
  await expect(weeklySection(page)).toContainText(goal.title)
  await weeklySection(page)
    .getByRole('button', { name: 'Editar meta', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Salvar meta', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(
    (await readData(page)).goals.find((item) => item.id === goal.id)?.deadline,
  ).toBeNull()
  await page.reload()
  await expect(weeklySection(page)).toContainText(goal.title)
  expect(errors).toEqual([])
})
