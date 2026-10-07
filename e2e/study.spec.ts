import { evidencePath } from './evidence.js'
import { readFile } from 'node:fs/promises'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  collections,
  snapshotSchema,
  type Snapshot,
  type Subject,
  type StudyPath,
} from '../src/data/models.js'

// All writes below occur in Playwright's fresh, disposable browser context.
// Tests never attach to a personal browser profile or the user's open Atlas tab.
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

async function localDay(page: Page, offset: number): Promise<string> {
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
  await page.goto('/estudos')
  await expect(
    page.getByRole('heading', { name: 'Estudos', level: 1, exact: true }),
  ).toBeVisible()
}

async function disclose(dialog: Locator) {
  const details = dialog.locator('details')
  for (let index = 0; index < (await details.count()); index++) {
    const detail = details.nth(index)
    if ((await detail.getAttribute('open')) === null)
      await detail.locator('summary').click()
  }
}

async function createSubject(page: Page, title: string): Promise<Subject> {
  await openList(page)
  await page
    .getByRole('button', { name: 'Nova disciplina', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Nova disciplina',
    exact: true,
  })
  await expect(
    dialog.getByLabel('Nome da disciplina', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Nome da disciplina', { exact: true }).fill(title)
  await disclose(dialog)
  await dialog.getByLabel('Código', { exact: true }).fill('CC-TESTE')
  await dialog
    .getByLabel('Semestre', { exact: true })
    .fill('Exemplo de semestre')
  await dialog
    .getByLabel('Professor', { exact: true })
    .fill('Docente de exemplo')
  await dialog.getByLabel('Carga horária', { exact: true }).fill('60')
  await dialog.getByLabel('Limite de faltas', { exact: true }).fill('5')
  await dialog.getByLabel('Aulas realizadas', { exact: true }).fill('10')
  await dialog
    .getByLabel('Tags', { exact: true })
    .fill('faculdade, fundamentos')
  await dialog
    .getByLabel('Anotações', { exact: true })
    .fill('Revisar fundamentos antes da próxima aula.')
  await dialog
    .getByRole('button', { name: 'Salvar disciplina', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('heading', { name: title, level: 1, exact: true }),
  ).toBeFocused()
  const subject = (await readData(page)).subjects.find(
    (item) => item.title === title,
  )
  if (!subject) throw new Error(`Disciplina ${title} não foi persistida.`)
  await expect(page).toHaveURL(`/estudos?subject=${subject.id}`)
  return subject
}

async function assessment(
  page: Page,
  title: string,
  score: number,
  maxScore: number,
  weight?: number,
) {
  await page
    .getByRole('button', { name: 'Adicionar avaliação', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Adicionar avaliação',
    exact: true,
  })
  await dialog.getByLabel('Nome da avaliação', { exact: true }).fill(title)
  await dialog.getByLabel('Nota obtida', { exact: true }).fill(String(score))
  await dialog.getByLabel('Nota máxima', { exact: true }).fill(String(maxScore))
  if (weight !== undefined)
    await dialog.getByLabel('Peso', { exact: true }).fill(String(weight))
  await dialog
    .getByLabel('Data', { exact: true })
    .fill(await localDay(page, -1))
  await dialog
    .getByLabel('Observação', { exact: true })
    .fill('Avaliação de exemplo para verificar o cálculo.')
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

async function createPath(page: Page, title: string): Promise<StudyPath> {
  await openList(page)
  await page.getByRole('button', { name: 'Nova trilha', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova trilha', exact: true })
  await expect(
    dialog.getByLabel('Título da trilha', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Título da trilha', { exact: true }).fill(title)
  await disclose(dialog)
  await dialog
    .getByLabel('Descrição', { exact: true })
    .fill('Pequenos passos de teoria e prática, sem pressa.')
  await dialog.getByLabel('Tags', { exact: true }).fill('cloud, prática')
  await dialog
    .getByRole('button', { name: 'Salvar trilha', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  const path = (await readData(page)).studyPaths.find(
    (item) => item.title === title,
  )
  if (!path) throw new Error(`Trilha ${title} não foi persistida.`)
  await expect(page).toHaveURL(`/estudos?path=${path.id}`)
  await expect(
    page.getByRole('heading', { name: title, level: 1, exact: true }),
  ).toBeFocused()
  return path
}

async function addStep(
  page: Page,
  title: string,
  options: { noteId?: string; taskId?: string } = {},
) {
  await page
    .getByRole('button', { name: 'Adicionar etapa', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Adicionar etapa',
    exact: true,
  })
  await expect(
    dialog.getByLabel('Título da etapa', { exact: true }),
  ).toBeFocused()
  await dialog.getByLabel('Título da etapa', { exact: true }).fill(title)
  await dialog
    .getByLabel('Link', { exact: true })
    .fill('https://example.com/fundamentos')
  await dialog.getByLabel('Estimativa em minutos', { exact: true }).fill('30')
  if (options.noteId)
    await dialog
      .getByRole('combobox', { name: 'Nota vinculada', exact: true })
      .selectOption(options.noteId)
  if (options.taskId)
    await dialog
      .getByRole('combobox', { name: 'Tarefa vinculada', exact: true })
      .selectOption(options.taskId)
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
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

async function openData(page: Page) {
  await page.getByRole('button', { name: 'Seus dados', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Seus dados', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function importFile(dialog: Locator, name: string, content: string) {
  await dialog
    .getByLabel('Arquivo para importar', { exact: true })
    .setInputFiles({
      name,
      mimeType: name.endsWith('.json') ? 'application/json' : 'text/markdown',
      buffer: Buffer.from(content),
    })
  await dialog
    .getByRole('button', { name: 'Confirmar importação', exact: true })
    .click()
  await expect(dialog.locator('.import-preview')).not.toBeVisible()
}

test('disciplina registra avaliações, média identificada, faltas e entrega vinculada sem copiar tarefas', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const subject = await createSubject(
    page,
    'Estruturas para compreender algoritmos',
  )
  await assessment(page, 'Primeira avaliação', 7, 10)
  await assessment(page, 'Segunda avaliação', 9, 10)
  await expect(page.getByText(/Média simples/)).toBeVisible()
  await expect(page.getByText(/8(?:,0)?\s*\/\s*10/).first()).toBeVisible()
  await assessment(page, 'Projeto prático', 10, 10, 2)
  await expect(page.getByText(/Média ponderada/)).toBeVisible()
  const beforeAbsence = (await readData(page)).subjects.find(
    (item) => item.id === subject.id,
  )!
  await page
    .getByRole('button', { name: 'Registrar falta', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await readData(page)).subjects.find((item) => item.id === subject.id)
          ?.absences,
    )
    .toBe(beforeAbsence.absences + 1)
  await expect(page.getByText(/90%/).first()).toBeVisible()
  await page
    .getByRole('button', { name: 'Nova prova ou entrega', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Nova prova ou entrega',
    exact: true,
  })
  const date = await localDay(page, 5)
  await dialog
    .getByLabel('Nome da prova ou entrega', { exact: true })
    .fill('Entregar implementação de árvores')
  await dialog
    .getByRole('combobox', { name: 'Tipo', exact: true })
    .selectOption('delivery')
  await dialog.getByLabel('Data', { exact: true }).fill(date)
  await dialog
    .getByLabel('Descrição', { exact: true })
    .fill('Implementar busca e percursos.')
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText(/Faltam 5 dias/).first()).toBeVisible()
  const beforeTasks = (await readData(page)).tasks.length
  await page
    .getByRole('button', {
      name: 'Criar tarefa para Entregar implementação de árvores',
      exact: true,
    })
    .click()
  const taskDialog = page.getByRole('dialog')
  await expect(taskDialog).toBeVisible()
  await taskDialog
    .getByLabel('Título da tarefa', { exact: true })
    .fill('Preparar entrega de árvores')
  await taskDialog
    .getByRole('button', { name: 'Criar tarefa', exact: true })
    .click()
  await expect(taskDialog).not.toBeVisible()
  const data = await readData(page)
  const task = data.tasks.find(
    (item) => item.title === 'Preparar entrega de árvores',
  )!
  const saved = data.subjects.find((item) => item.id === subject.id)!
  expect(data.tasks).toHaveLength(beforeTasks + 1)
  expect(task.links).toContainEqual({ type: 'subjects', id: subject.id })
  expect(task.dueDate).toBe(date)
  expect(saved.events[0]?.taskId).toBe(task.id)
  expect(
    saved.assessments.map(({ title, score, maxScore, weight }) => ({
      title,
      score,
      maxScore,
      weight,
    })),
  ).toEqual([
    { title: 'Primeira avaliação', score: 7, maxScore: 10, weight: null },
    { title: 'Segunda avaliação', score: 9, maxScore: 10, weight: null },
    { title: 'Projeto prático', score: 10, maxScore: 10, weight: 2 },
  ])
  await page.locator(`a[href="/tarefas?task=${task.id}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/tarefas\\?task=${task.id}`))
  await expect(
    page
      .getByRole('dialog', { name: 'Editar tarefa', exact: true })
      .getByLabel('Nome', { exact: true }),
  ).toHaveValue(task.title)
  await page.keyboard.press('Escape')
  await page.goto(`/estudos?subject=${subject.id}`)
  await page.reload()
  expect(
    (await readData(page)).subjects.find((item) => item.id === subject.id),
  ).toEqual(saved)
  await axe(page)
  expect(errors).toEqual([])
})

test('trilha conecta uma etapa a nota e tarefa existentes, mostra próximo passo e recalcula conclusão', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const path = await createPath(page, 'AWS com teoria e prática')
  const initial = await readData(page)
  const note = initial.notes[0]!
  const task = initial.tasks[0]!
  await addStep(page, 'Compreender regiões e zonas', {
    noteId: note.id,
    taskId: task.id,
  })
  await addStep(page, 'Experimentar permissões mínimas')
  await expect(page.getByText(/Próximo passo/).first()).toBeVisible()
  await page
    .getByRole('button', {
      name: 'Concluir etapa Compreender regiões e zonas',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('progressbar', { name: /Progresso/ }),
  ).toHaveAttribute('value', '50')
  const data = await readData(page)
  const saved = data.studyPaths.find((item) => item.id === path.id)!
  expect(saved.steps[0]).toMatchObject({
    done: true,
    noteId: note.id,
    taskId: task.id,
    estimatedMinutes: 30,
  })
  expect(data.notes).toHaveLength(initial.notes.length)
  expect(data.tasks).toHaveLength(initial.tasks.length)
  await page.locator(`a[href="/notas?note=${note.id}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/notas\\?note=${note.id}`))
  await expect(
    page.getByRole('heading', { name: note.title, level: 1, exact: true }),
  ).toBeVisible()
  await page.goto(`/estudos?path=${path.id}`)
  await page
    .getByRole('button', {
      name: 'Concluir etapa Experimentar permissões mínimas',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('progressbar', { name: /Progresso/ }),
  ).toHaveAttribute('value', '100')
  await page.reload()
  expect(
    (await readData(page)).studyPaths
      .find((item) => item.id === path.id)
      ?.steps.every((step) => step.done),
  ).toBe(true)
  await axe(page)
  expect(errors).toEqual([])
})

test('arquivar e excluir disciplinas e trilhas podem ser desfeitos após refresh, preservando detalhes', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const subject = await createSubject(
    page,
    'Disciplina que pode ser recuperada',
  )
  await assessment(page, 'Avaliação preservada', 9, 10)
  const before = (await readData(page)).subjects.find(
    (item) => item.id === subject.id,
  )!
  await page
    .getByRole('button', { name: 'Arquivar disciplina', exact: true })
    .click()
  await expect
    .poll(
      async () =>
        (await readData(page)).subjects.find((item) => item.id === subject.id)
          ?.status,
    )
    .toBe('archived')
  await page.reload()
  await page.getByText('Última ação em estudos', { exact: true }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await readData(page)).subjects.find((item) => item.id === subject.id)
          ?.status,
    )
    .toBe('active')
  await page.goto(`/estudos?subject=${subject.id}`)
  await page
    .getByRole('button', { name: 'Excluir disciplina', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Estudos', level: 1, exact: true }),
  ).toBeFocused()
  await page.reload()
  await page.getByText('Última ação em estudos', { exact: true }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  const restored = (await readData(page)).subjects.find(
    (item) => item.id === subject.id,
  )!
  expect({ ...restored, updatedAt: '' }).toEqual({ ...before, updatedAt: '' })
  const path = await createPath(page, 'Trilha que pode ser recuperada')
  await addStep(page, 'Uma etapa preservada')
  const pathBefore = (await readData(page)).studyPaths.find(
    (item) => item.id === path.id,
  )!
  await page
    .getByRole('button', { name: 'Arquivar trilha', exact: true })
    .click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  await page.goto(`/estudos?path=${path.id}`)
  await page
    .getByRole('button', { name: 'Excluir trilha', exact: true })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Excluir', exact: true })
    .click()
  await page.reload()
  await page.getByText('Última ação em estudos', { exact: true }).click()
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
  const pathRestored = (await readData(page)).studyPaths.find(
    (item) => item.id === path.id,
  )!
  expect({ ...pathRestored, updatedAt: '' }).toEqual({
    ...pathBefore,
    updatedAt: '',
  })
  expect(errors).toEqual([])
})

for (const format of ['json', 'md'] as const) {
  test(`backup ${format} restaura disciplinas, avaliações, presença, trilhas e relações depois de limpar o banco`, async ({
    page,
  }) => {
    const errors = watchErrors(page)
    const subject = await createSubject(page, 'Disciplina incluída no backup')
    await assessment(page, 'Avaliação no backup', 8, 10, 2)
    await page
      .getByRole('button', { name: 'Registrar falta', exact: true })
      .click()
    const path = await createPath(page, 'Trilha incluída no backup')
    const existing = await readData(page)
    await addStep(page, 'Etapa com referências', {
      noteId: existing.notes[0]!.id,
      taskId: existing.tasks[0]!.id,
    })
    const before = await readData(page)
    expect(before.subjects.some((item) => item.id === subject.id)).toBe(true)
    expect(before.studyPaths.some((item) => item.id === path.id)).toBe(true)
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
    await importFile(dialog, `estudos.${format}`, text)
    // Imports convert example records to personal data; every other field is exact.
    const personal = snapshotSchema.parse(before)
    for (const name of collections)
      for (const item of personal[name]) item.isExample = false
    expect(await readData(page)).toEqual(personal)
    await page.reload()
    expect(await readData(page)).toEqual(personal)
    expect(errors).toEqual([])
  })
}

test('criação e edição por teclado preservam foco, cancelamento e contenção da sheet', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  const trigger = page.getByRole('button', {
    name: 'Nova disciplina',
    exact: true,
  })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', {
    name: 'Nova disciplina',
    exact: true,
  })
  await expect(
    dialog.getByLabel('Nome da disciplina', { exact: true }),
  ).toBeFocused()
  await page.keyboard.type('Cancelamento não cria dados')
  await page.keyboard.press('Shift+Tab')
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(
    (await readData(page)).subjects.some(
      (item) => item.title === 'Cancelamento não cria dados',
    ),
  ).toBe(false)
  await page.keyboard.press('Enter')
  await page.keyboard.type('Disciplina criada pelo teclado')
  const save = dialog.getByRole('button', {
    name: 'Salvar disciplina',
    exact: true,
  })
  for (
    let count = 0;
    count < 35 &&
    !(await save.evaluate((element) => element === document.activeElement));
    count++
  )
    await page.keyboard.press('Tab')
  await expect(save).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', {
      name: 'Disciplina criada pelo teclado',
      level: 1,
      exact: true,
    }),
  ).toBeFocused()
  await page
    .getByRole('button', { name: 'Editar disciplina', exact: true })
    .focus()
  await page.keyboard.press('Enter')
  await expect(
    page
      .getByRole('dialog', { name: 'Editar disciplina', exact: true })
      .getByLabel('Nome da disciplina', { exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Editar disciplina', exact: true }),
  ).toBeFocused()
  await axe(page)
  expect(errors).toEqual([])
})

test('disciplinas e trilhas de exemplo são identificadas, removíveis e não reaparecem', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openList(page)
  const before = await readData(page)
  expect(
    before.subjects
      .filter((item) => item.isExample)
      .map((item) => item.title)
      .sort(),
  ).toEqual(['Estruturas de Dados', 'Sistemas Operacionais'])
  expect(
    before.studyPaths
      .filter((item) => item.isExample)
      .map((item) => item.title)
      .sort(),
  ).toEqual([
    'AWS Cloud Fundamentals',
    'Cibersegurança Básica',
    'Fundamentos de DevOps',
  ])
  const dialog = await openData(page)
  await dialog
    .getByRole('button', { name: 'Remover exemplos (20)', exact: true })
    .click()
  await expect(
    dialog.getByText('0 registros salvos localmente', { exact: true }),
  ).toBeVisible()
  await page.reload()
  expect(
    Object.values(await readData(page)).every((items) =>
      Array.isArray(items) ? items.length === 0 : items === null,
    ),
  ).toBe(true)
  await expect(
    page
      .getByText(
        /Crie uma disciplina|Adicione uma disciplina|Sua primeira disciplina/,
      )
      .first(),
  ).toBeVisible()
  const panel = await openData(page)
  await panel
    .getByRole('button', { name: 'Desfazer remoção', exact: true })
    .click()
  const restored = await readData(page)
  for (const name of collections) expect(restored[name]).toEqual(before[name])
  expect(errors).toEqual([])
})

test('Estudos mantém leitura e formulários em 375/768/1280, dois temas e texto a 200%', async ({
  page,
}) => {
  test.setTimeout(300_000)
  const errors = watchErrors(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const subject = await createSubject(
    page,
    'Fundamentos de algoritmos, estruturas de dados e análise de complexidade',
  )
  await assessment(
    page,
    'Avaliação com nome longo e observações para ler com conforto',
    8,
    10,
    2,
  )
  const path = await createPath(
    page,
    'Compreender cloud e DevOps com pequenos projetos práticos',
  )
  await addStep(
    page,
    'Um pequeno próximo passo para compreender os fundamentos e experimentar com calma',
  )
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['Claro', 'Escuro']) {
      await page.getByRole('button', { name: 'Aparência', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      await page.keyboard.press('Escape')
      for (const [kind, id, edit] of [
        ['subject', subject.id, 'Editar disciplina'],
        ['path', path.id, 'Editar trilha'],
      ] as const) {
        await page.goto(`/estudos?${kind}=${id}`)
        await noOverflow(page)
        await expect(page.locator('.direction-detail')).toHaveCSS(
          'backdrop-filter',
          'none',
        )
        expect(
          await page
            .locator('.direction-detail button')
            .evaluateAll((buttons) =>
              buttons.every((button) => {
                const rect = button.getBoundingClientRect()
                return rect.width >= 44 && rect.height >= 44
              }),
            ),
        ).toBe(true)
        await axe(page)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: evidencePath(
            `docs/screenshots/etapa-7b1-${kind}-${theme.toLowerCase()}-${width}.png`,
          ),
        })
        await page.getByRole('button', { name: edit, exact: true }).click()
        const dialog = page.getByRole('dialog', { name: edit, exact: true })
        await disclose(dialog)
        await noOverflow(page, dialog)
        await axe(page)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
        await noOverflow(page, dialog)
        await axe(page)
        await page.keyboard.press('Escape')
        await noOverflow(page)
        await axe(page)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = ''
        })
      }
      await openList(page)
      await noOverflow(page)
      await axe(page)
      await page.screenshot({
        path: evidencePath(
          `docs/screenshots/etapa-7b1-estudos-${theme.toLowerCase()}-${width}.png`,
        ),
      })
    }
  }
  await page.getByRole('button', { name: 'Aparência', exact: true }).click()
  await page
    .getByRole('checkbox', { name: 'Reduzir transparência', exact: true })
    .check()
  await page.keyboard.press('Escape')
  await expect(page.locator('.toolbar')).toHaveCSS('backdrop-filter', 'none')
  await page
    .getByRole('button', { name: 'Nova disciplina', exact: true })
    .click()
  await expect(page.getByRole('dialog').locator('.glass')).toHaveCSS(
    'backdrop-filter',
    'none',
  )
  const transition = await page
    .getByRole('dialog')
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(
    transition
      .split(',')
      .every((duration) => Number.parseFloat(duration) === 0),
  ).toBe(true)
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})
