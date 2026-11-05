import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// Presentation evidence only. Fresh in-memory browser context, never a user profile.
const origin = 'http://127.0.0.1:4180'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  baseURL: origin,
  viewport: { width: 1440, height: 1000 },
  timezoneId: 'America/Sao_Paulo',
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await context.route('**/*', (route) =>
  new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.abort(),
)
const captures = []
await mkdir('docs/screenshots/delivery', { recursive: true })
async function capture(name, route, target = page) {
  await page.goto(route)
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('[data-route-loading]')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await target.screenshot({
    path: `docs/screenshots/delivery/${name}.png`,
    fullPage: name === 'perfil',
  })
  captures.push({ file: `${name}.png`, route, fictionalData: true })
}
try {
  await page.goto('/')
  await page.locator('.today-widget-grid').waitFor()
  // Modify only the seed in this disposable context. No export from a user database.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('atlas-local')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const read = (name) =>
      new Promise((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    const names = [
      'tasks',
      'habits',
      'habitLogs',
      'notes',
      'goals',
      'projects',
      'subjects',
      'studyPaths',
      'flashcards',
      'focusSessions',
    ]
    const data = Object.fromEntries(
      await Promise.all(names.map(async (name) => [name, await read(name)])),
    )
    const now = new Date()
    const key = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const today = key(now)
    const shifted = (days) => {
      const date = new Date(now)
      date.setDate(date.getDate() + days)
      return date
    }
    const stamp = now.toISOString()
    const old = shifted(-90).toISOString()
    for (const name of names)
      for (const record of data[name]) {
        record.isExample = false
        record.createdAt = old
        record.updatedAt = stamp
        record.tags = ['demonstracao']
      }
    data.tasks.forEach((task, index) => {
      task.title = [
        'Comparar listas e árvores',
        'Explorar permissões de cloud',
        'Esboçar o projeto Aurora',
      ][index]
      task.status = index === 2 ? 'done' : 'todo'
      task.dueDate = today
      task.context = index === 0 ? 'Estudos' : 'Projetos'
    })
    data.tasks[0].subtasks = [
      { id: 'demo-subtask', title: 'Anotar os custos de busca', done: true },
    ]
    data.tasks.push({
      ...data.tasks[0],
      id: 'demo-appointment',
      title: 'Revisão de projeto (fictícia)',
      dueDate: key(shifted(1)),
      dueTime: '19:00',
      tags: ['compromisso'],
      context: 'Pessoal',
      links: [],
      subtasks: [],
      priority: 'low',
    })
    data.projects[0].title = 'Projeto Aurora'
    data.projects[0].description =
      'Projeto fictício de um organizador de leituras.'
    data.projects[1].title = 'Laboratório de cloud (fictício)'
    data.goals[0].title = 'Completar os primeiros módulos de cloud'
    data.goals[0].status = 'active'
    data.goals[0].weekly = true
    data.goals[0].keyResults[0] = {
      id: 'demo-kr',
      title: 'Módulos revisados',
      current: 3,
      target: 10,
      unit: 'módulos',
    }
    data.goals[0].deadline = key(shifted(5))
    data.notes[0].title = 'Listas e árvores'
    data.notes[0].content =
      '# Listas e árvores\n\nConteúdo fictício para demonstrar uma nota de aula.\n\n## Ideia principal\nA estrutura escolhida muda o custo de cada operação.\n\n| Operação | Lista | Árvore balanceada |\n| --- | --- | --- |\n| Busca | O(n) | O(log n) |\n\n## Próximo passo\n- Comparar inserção e busca.\n- Registrar o experimento em [[Projeto Aurora]].'
    data.notes[1].title = 'Projeto Aurora'
    data.notes[1].content =
      '# Projeto Aurora\n\nUma ideia fictícia: organizar leituras e pequenas descobertas.\n\nAplicar os conceitos de [[Listas e árvores]] em um protótipo pequeno.'
    data.studyPaths[0].steps[0].done = true
    data.subjects[0].notes =
      'Disciplina fictícia para apresentação. Não representa um histórico acadêmico.'
    data.subjects[0].events = [
      {
        id: 'demo-exam',
        title: 'Exercício de estruturas (fictício)',
        kind: 'delivery',
        date: key(shifted(4)),
        status: 'pending',
        description: 'Comparar duas estruturas com exemplos pequenos.',
        taskId: data.tasks[0].id,
      },
    ]
    data.subjects[0].assessments = [
      {
        id: 'demo-grade',
        title: 'Exercício demonstrativo',
        score: 8,
        maxScore: 10,
        weight: null,
        date: today,
        notes: 'Nota fictícia.',
      },
    ]
    data.habitLogs = []
    for (let day = -90; day <= 0; day++) {
      if (day % 6 === 0) continue
      data.habits.forEach((habit, index) => {
        if ((day + index) % 3 === 0) return
        const date = key(shifted(day)),
          at = shifted(day).toISOString()
        data.habitLogs.push({
          id: `demo-log-${day + 90}-${index}`,
          habitId: habit.id,
          date,
          value:
            habit.kind === 'binary'
              ? 1
              : habit.target * (0.5 + ((day + 90 + index) % 3) * 0.25),
          rest: false,
          tags: ['demonstracao'],
          links: [],
          isExample: false,
          createdAt: at,
          updatedAt: at,
        })
      })
    }
    const endedAt = new Date(now.getTime() - 30 * 60_000).toISOString()
    data.focusSessions = [
      {
        id: 'demo-focus',
        title: data.tasks[0].title,
        mode: 'focus',
        status: 'completed',
        timerState: 'paused',
        plannedSeconds: 1500,
        elapsedMs: 1_500_000,
        segmentStartedAt: null,
        startedAt: new Date(now.getTime() - 55 * 60_000).toISOString(),
        endedAt,
        taskId: data.tasks[0].id,
        tags: ['demonstracao'],
        links: [],
        isExample: false,
        createdAt: old,
        updatedAt: stamp,
      },
    ]
    data.tasks[0].focusMinutes = 25
    const profile = {
      name: 'Pessoa Exemplo',
      handle: '@exemplo',
      bio: 'Um passo por vez. Perfil fictício para demonstração.',
      avatarStyle: 'neutral',
      avatar: null,
      pinned: [
        { type: 'projects', id: data.projects[0].id },
        { type: 'studyPaths', id: data.studyPaths[0].id },
      ],
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction([...names, 'meta'], 'readwrite')
      for (const name of names) {
        const store = tx.objectStore(name)
        store.clear()
        for (const item of data[name]) store.put(item)
      }
      tx.objectStore('meta').put({ key: 'profile', value: profile })
      tx.objectStore('meta').put({ key: 'activity', value: [] })
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    db.close()
    localStorage.setItem(
      'atlas.preferences.v1',
      JSON.stringify({
        theme: 'dark',
        accent: 'blue',
        contexts: ['Estudos', 'Projetos', 'Pessoal'],
        motion: 'system',
        transparency: 'system',
      }),
    )
  })
  // Keep the original 10A widget-region framing; never edit DOM/CSS for a capture.
  await capture('hoje', '/', page.locator('.today-widget-grid'))
  await capture('tarefas', '/tarefas')
  await capture(
    'habitos',
    '/habitos?habit=example-habit-2',
    page.locator('.heatmap-section'),
  )
  await page.goto('/notas?note=example-note-0')
  await page
    .getByRole('button', { name: 'Pré-visualizar', exact: true })
    .click()
  await expect(
    page.getByRole('article', { name: 'Pré-visualização da nota' }),
  ).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/delivery/notas.png' })
  captures.push({
    file: 'notas.png',
    route: '/notas?note=example-note-0',
    fictionalData: true,
  })
  await capture('estudos', '/estudos')
  await page.goto('/foco?task=example-task-0')
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await page.getByRole('button', { name: 'Pausar', exact: true }).click()
  await page.screenshot({ path: 'docs/screenshots/delivery/foco.png' })
  captures.push({
    file: 'foco.png',
    route: '/foco?task=example-task-0',
    fictionalData: true,
  })
  await capture('perfil', '/perfil')
  expect(errors).toEqual([])
  await writeFile(
    'docs/delivery-captures-10a.json',
    JSON.stringify(
      {
        origin,
        viewport: { width: 1440, height: 1000 },
        browser: 'Edge headless',
        disposableContext: true,
        fictionalData: true,
        cssOrDomAltered: false,
        todayHeaderOmitted:
          'Widget-region crop retains original framing; greeting now uses the local profile.',
        captures,
        pageErrors: errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`${captures.length} fictional presentation captures saved.`)
} finally {
  await context.close()
  await browser.close()
}
