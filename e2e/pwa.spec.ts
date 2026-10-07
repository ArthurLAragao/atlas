import { evidencePath } from './evidence.js'
import { test, expect, chromium } from '@playwright/test'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'

test('manifest, ícones, controle do SW e recarga offline com dados e rotas inéditas', async ({
  page,
  context,
}) => {
  await page.goto('/preferencias')
  await expect(
    page.getByRole('heading', { name: 'Preferências', exact: true }),
  ).toBeVisible()
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  expect(manifestUrl).toBeTruthy()
  const response = await page.request.get(manifestUrl!)
  const manifest: {
    name: string
    short_name: string
    description: string
    display: string
    start_url: string
    scope: string
    icons: { src: string; sizes: string; purpose: string }[]
  } = await response.json()
  expect(manifest).toMatchObject({
    name: 'Atlas',
    short_name: 'Atlas',
    description:
      'Seu espaço pessoal para tarefas, hábitos, estudos e projetos.',
    display: 'standalone',
    start_url: '/',
    scope: '/',
  })
  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(icon.src)
    expect(iconResponse.ok()).toBe(true)
    const bytes = await iconResponse.body()
    const size = Number(icon.sizes.split('x')[0])
    expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    expect(bytes.readUInt32BE(16)).toBe(size)
    expect(bytes.readUInt32BE(20)).toBe(size)
  }
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  await expect(
    page.getByText('App preparado para recarga offline neste navegador.'),
  ).toBeVisible({ timeout: 30000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Preferências', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true)
  // Chrome's installability diagnostics validate a real manifest and service worker.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Page.enable')
  const installability = await cdp.send('Page.getInstallabilityErrors')
  // Isolated Playwright contexts are incognito. Installation itself is checked
  // separately below in a fresh non-incognito profile, never the user's profile.
  expect(
    installability.installabilityErrors.filter(
      (error) => error.errorId !== 'in-incognito',
    ),
  ).toEqual([])
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  const before = JSON.parse(
    await readFile((await (await downloadPromise).path())!, 'utf8'),
  ) as { data: unknown }
  await context.setOffline(true)
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Preferências', exact: true }),
  ).toBeVisible()
  // Edge's CDP emulation resets navigator.onLine on a service-worker navigation,
  // while network requests remain blocked. Confirm the real network failure and
  // reapply the protocol's reported network state, without changing app APIs.
  expect(
    await page.evaluate(async () => {
      try {
        await fetch(`/offline-proof-${Date.now()}`, { cache: 'no-store' })
        return false
      } catch {
        return true
      }
    }),
  ).toBe(true)
  await cdp.send('Network.overrideNetworkState', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  })
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  await expect(page.getByText(/Você está offline/)).toBeVisible()
  for (const [path, title] of [
    ['/habitos', 'Hábitos'],
    ['/notas', 'Notas'],
    ['/estudos', 'Estudos'],
    ['/tarefas', 'Tarefas'],
    ['/metas', 'Metas e projetos'],
    ['/foco', 'Foco'],
    ['/perfil', 'Personalize seu espaço'],
    ['/', 'Hoje'],
  ] as const) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { name: title, exact: true, level: 1 }),
    ).toBeVisible()
  }
  await page.getByRole('button', { name: 'Anotar algo', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Capturar ou navegar' })
    .fill('nota: Anotação offline')
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Título da nota')).toHaveValue(
    'Anotação offline',
  )
  await page.goto('/preferencias')
  const offlineDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click()
  const after = JSON.parse(
    await readFile((await (await offlineDownload).path())!, 'utf8'),
  ) as { data: { notes: { title: string }[] } }
  expect(
    after.data.notes.some((note) => note.title === 'Anotação offline'),
  ).toBe(true)
  const { snapshotSchema } = await import('../src/data/models.js')
  const old = snapshotSchema.parse(before.data)
  const current = snapshotSchema.parse(after.data)
  for (const note of old.notes) expect(current.notes).toContainEqual(note)
  const { collections } = await import('../src/data/models.js')
  for (const name of collections)
    if (name !== 'notes') expect(current[name]).toEqual(old[name])
  expect(current.experience).toEqual(old.experience)
  await cdp.send('Network.overrideNetworkState', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await context.setOffline(false)
  await expect(page.getByText(/Você está offline/)).toHaveCount(0)
  await page.reload()
  await page.goto('/notas')
  await expect(
    page.getByRole('link', { name: /Anotação offline/ }),
  ).toBeVisible()
})

test('instalabilidade sem erros em perfil temporário fora do modo anônimo', async ({
  baseURL,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-install-check-'))
  if (
    !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
    !directory.includes('atlas-install-check-')
  )
    throw new Error('Diretório de teste inesperado')
  const context = await chromium.launchPersistentContext(directory, {
    channel: 'msedge',
    headless: true,
    baseURL,
  })
  try {
    const page = await context.newPage()
    await page.goto('/preferencias')
    await expect(
      page.getByRole('heading', { name: 'Preferências', exact: true }),
    ).toBeVisible({ timeout: 20000 })
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Preferências', exact: true }),
    ).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Page.enable')
    const result = await cdp.send('Page.getInstallabilityErrors')
    expect(result.installabilityErrors).toEqual([])
    await writeFile(
      evidencePath('docs/pwa-installability.json'),
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          url: baseURL,
          browser: 'Microsoft Edge, temporary non-incognito profile',
          actualOsInstallationTested: false,
          ...result,
        },
        null,
        2,
      ),
    )
  } finally {
    await context.close()
    await rm(directory, { recursive: true, force: true })
  }
})
