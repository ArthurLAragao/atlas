import { chromium, expect } from '@playwright/test'
import { readFile, readdir, writeFile } from 'node:fs/promises'

// Local delivery preflight, not a deployment or a physical installation test.
const origin = 'http://127.0.0.1:4180'
const paths = [
  '/',
  '/notas',
  '/rota-inexistente-10a',
  '/assets/inexistente-10a.js',
  '/manifest.webmanifest',
  '/sw.js',
]
const responses = []
let manifest
for (const path of paths) {
  const response = await fetch(`${origin}${path}`, { redirect: 'error' })
  const body = await response.text()
  responses.push({
    path,
    status: response.status,
    contentType: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    htmlDocument: body.includes('<html'),
  })
  if (path === '/manifest.webmanifest') manifest = JSON.parse(body)
}
const icons = await Promise.all(
  manifest.icons.map(async (icon) => {
    const response = await fetch(new URL(icon.src, origin), {
      redirect: 'error',
    })
    return {
      src: icon.src,
      sizes: icon.sizes,
      purpose: icon.purpose,
      status: response.status,
      contentType: response.headers.get('content-type'),
    }
  }),
)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ baseURL: origin })
const page = await context.newPage()
await context.route('**/*', (route) =>
  new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.abort(),
)
let unknownRoute
try {
  await page.goto('/rota-inexistente-10a')
  await expect(page.locator('main h1')).toBeVisible()
  unknownRoute = await page.locator('main h1').innerText()
} finally {
  await context.close()
  await browser.close()
}
const assets = (await readdir('dist/assets')).filter((name) =>
  /\.(js|css)$/.test(name),
)
const output = {
  stage: '10A',
  origin,
  checkedAt: new Date().toISOString(),
  localOnly: true,
  disposableBrowserContext: true,
  deploymentExecuted: false,
  responses,
  manifest,
  icons,
  unknownRoute,
  productionAssets: await Promise.all(
    assets.map(async (name) => ({
      name,
      bytes: (await readFile(`dist/assets/${name}`)).byteLength,
    })),
  ),
  limitations: [
    'Preview local não comprova headers/fallback da futura hospedagem HTTPS.',
    'Não houve instalação física, nova medição Lighthouse ou nova suíte E2E completa.',
    'Performance e autorização de publicação continuam pendentes.',
  ],
}
await writeFile(
  'docs/staging-preflight-10a.json',
  `${JSON.stringify(output, null, 2)}\n`,
)
console.log(JSON.stringify({ responses, unknownRoute, icons }))
