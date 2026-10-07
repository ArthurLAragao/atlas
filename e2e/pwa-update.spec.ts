import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join, extname, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { generateSW } from 'workbox-build'

test('SW real instala uma nova revisão, espera Atualizar e preserva dados', async ({
  page,
  context,
}) => {
  const second = await mkdtemp(join(tmpdir(), 'atlas-pwa-update-'))
  if (
    !resolve(second).startsWith(resolve(tmpdir()) + sep) ||
    !second.includes('atlas-pwa-update-')
  )
    throw new Error('Diretório de teste inesperado')
  let root = resolve('dist')
  const types: Record<string, string> = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      )
      const file = resolve(
        root,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      )
      if (!file.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
      }
      const bytes = await readFile(file)
      response
        .writeHead(200, {
          'Content-Type': types[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(bytes)
    } catch {
      response.writeHead(404).end()
    }
  })
  try {
    await cp(root, second, { recursive: true })
    const html = await readFile(join(second, 'index.html'), 'utf8')
    await writeFile(
      join(second, 'index.html'),
      html.replace(
        '</head>',
        '<meta name="atlas-update-test" content="new-build" /></head>',
      ),
    )
    // Same Workbox policy as production; the changed HTML receives a new revision.
    const result = await generateSW({
      globDirectory: second,
      swDest: join(second, 'sw.js'),
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      globIgnores: ['sw.js', 'workbox-*.js'],
      cleanupOutdatedCaches: true,
      navigateFallback: 'index.html',
      clientsClaim: true,
      skipWaiting: false,
    })
    expect(result.warnings).toEqual([])
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Servidor de teste indisponível')
    const origin = `http://127.0.0.1:${address.port}`
    await page.goto(origin)
    await expect(
      page.getByRole('heading', { name: 'Hoje', exact: true }),
    ).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Hoje', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Anotar algo', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Capturar ou navegar' })
      .fill('nota: Mantida na atualização')
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Título da nota')).toHaveValue(
      'Mantida na atualização',
    )
    const draft = 'Rascunho ainda não salvo, preservado durante a atualização.'
    await page.getByLabel('Conteúdo Markdown', { exact: true }).fill(draft)
    const focus = await context.newPage()
    await focus.goto(`${origin}/foco`)
    await focus.getByRole('button', { name: 'Iniciar', exact: true }).click()
    await expect(
      focus.getByRole('button', { name: 'Pausar', exact: true }),
    ).toBeVisible()
    const activeId = await focus.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const request = indexedDB.open('atlas-local')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const read = db
              .transaction('focusSessions')
              .objectStore('focusSessions')
              .getAll()
            read.onsuccess = () => {
              const sessions = read.result as { id: string; status: string }[]
              db.close()
              resolve(
                sessions.find((session) => session.status === 'in-progress')!
                  .id,
              )
            }
          }
        }),
    )
    expect(await page.locator('meta[name="atlas-update-test"]').count()).toBe(0)
    root = second
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update()
    })
    await expect(
      page.getByRole('button', { name: 'Atualizar', exact: true }),
    ).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Agora não' }).click()
    expect(await page.locator('meta[name="atlas-update-test"]').count()).toBe(0)
    const editorUrl = page.url()
    await page.goto(`${origin}/preferencias`)
    await page.getByRole('button', { name: 'Verificar atualização' }).click()
    await expect(
      page.getByRole('button', { name: 'Atualizar', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Agora não' }).click()
    await page.goto(editorUrl)
    // New page reports the waiting worker again, without forcing activation.
    await page.reload()
    await expect(
      page.getByLabel('Conteúdo Markdown', { exact: true }),
    ).toHaveValue(draft)
    await expect(
      page.getByRole('button', { name: 'Atualizar', exact: true }),
    ).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
    await expect(
      page.locator('meta[name="atlas-update-test"]'),
    ).toHaveAttribute('content', 'new-build', { timeout: 30000 })
    await expect(page.getByLabel('Título da nota')).toHaveValue(
      'Mantida na atualização',
    )
    await expect(
      page.getByLabel('Conteúdo Markdown', { exact: true }),
    ).toHaveValue(draft)
    await focus.reload()
    await expect(
      focus.getByRole('button', { name: 'Pausar', exact: true }),
    ).toBeVisible()
    expect(
      await focus.evaluate(
        () =>
          new Promise<{ id: string; status: string }[]>((resolve, reject) => {
            const request = indexedDB.open('atlas-local')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const db = request.result
              const read = db
                .transaction('focusSessions')
                .objectStore('focusSessions')
                .getAll()
              read.onsuccess = () => {
                db.close()
                resolve(read.result as { id: string; status: string }[])
              }
            }
          }),
      ),
    ).toMatchObject([{ id: activeId, status: 'in-progress' }])
    expect(
      await page.evaluate(
        async () => !(await navigator.serviceWorker.getRegistration())?.waiting,
      ),
    ).toBe(true)
  } finally {
    await new Promise<void>((done) => server.close(() => done()))
    await rm(second, { recursive: true, force: true })
  }
})
