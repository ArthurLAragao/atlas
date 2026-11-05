import { chromium } from '@playwright/test'
import { navigation } from 'lighthouse'
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import config from './lighthouse.config.mjs'

const url =
  process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) ??
  'http://127.0.0.1:4180/'
const cold = process.argv.includes('--cold')
const reportName = process.argv
  .find((arg) => arg.startsWith('--report-name='))
  ?.slice(14)
if (reportName && !/^[a-z0-9-]+$/.test(reportName))
  throw new Error('Use um nome de relatório simples, sem caminhos.')
const probe = createServer()
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
const address = probe.address()
if (!address || typeof address === 'string')
  throw new Error('Porta indisponível')
const port = address.port
await new Promise((resolve) => probe.close(resolve))
const profile = await mkdtemp(join(tmpdir(), 'atlas-lighthouse-return-'))
if (
  !resolve(profile).startsWith(resolve(tmpdir()) + sep) ||
  !profile.includes('atlas-lighthouse-return-')
)
  throw new Error('Perfil temporário inesperado')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'msedge',
  headless: true,
  args: [`--remote-debugging-port=${port}`],
})
let auditBrowser
try {
  // Fresh temporary profile; first access initializes local data and precache.
  // This report measures RETURN use, separately from the cold report.
  const page = context.pages()[0] ?? (await context.newPage())
  if (cold) {
    // Let Edge's fresh-profile startup settle without visiting Atlas.
    // The first Atlas navigation still has empty caches and IndexedDB.
    await page.waitForTimeout(10000)
    if (page.url() !== 'about:blank')
      throw new Error('Perfil já navegou antes da medição fria')
  }
  if (!cold) {
    await page.goto(url)
    await page
      .getByRole('heading', { name: 'Hoje', exact: true, level: 1 })
      .waitFor()
    await page.evaluate(() => navigator.serviceWorker.ready)
    // Start from a blank frame just as a normal navigation audit does.
    // Caches, service worker and IndexedDB remain prepared for RETURN only.
    await page.goto('about:blank')
  }
  auditBrowser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null,
  })
  const auditPage = (await auditBrowser.pages()).find(
    (tab) => tab.url() === page.url(),
  )
  if (!auditPage) throw new Error('Aba de medição não encontrada.')
  const result = await navigation(
    auditPage,
    async () => {
      await auditPage.goto(url)
      // IndexedDB can outlast network quiet. The documented navigation callback
      // keeps the SAME cold trace open until the actual view has rendered.
      // No visit, cache warming or database initialization occurs before it.
      await auditPage.waitForFunction(
        () => document.querySelector('main h1')?.textContent?.trim() === 'Hoje',
        { timeout: 45_000 },
      )
      await auditPage.waitForSelector('.today-page', { visible: true })
      await auditPage.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
      // DOM readiness precedes paint. Preserve a quiet frame in the filmstrip,
      // using the same 1 s network-idle criterion as Lighthouse's default.
      await auditPage.waitForNetworkIdle({ idleTime: 1000, timeout: 45_000 })
    },
    {
      config,
      flags: {
        disableStorageReset: true,
        output: ['json', 'html'],
        logLevel: 'error',
      },
    },
  )
  if (!result || !Array.isArray(result.report))
    throw new Error('Relatório indisponível')
  const readyTitle = await page
    .locator('main h1')
    .textContent({ timeout: 1000 })
  if (readyTitle?.trim() !== 'Hoje')
    throw new Error('Medição inválida: a tela Hoje não terminou de abrir.')
  const stage = process.argv.includes('--redesign')
    ? 'redesign-9a'
    : process.argv.includes('--stage9a')
      ? 'stage9a'
      : 'stage8'
  const name = reportName ?? `lighthouse-${stage}${cold ? '' : '-return'}`
  await writeFile(
    new URL(`../docs/${name}.report.json`, import.meta.url),
    JSON.stringify(result.lhr, null, 2),
  )
  await writeFile(
    new URL(`../docs/${name}.report.html`, import.meta.url),
    result.report[1],
  )
  console.log(
    JSON.stringify(
      {
        scenario: cold
          ? 'first-access-in-new-profile'
          : 'return-after-online-preparation',
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([name, category]) => [
            name,
            Math.round(category.score * 100),
          ]),
        ),
        warnings: result.lhr.runWarnings,
      },
      null,
      2,
    ),
  )
} finally {
  await auditBrowser?.disconnect()
  await context.close()
  await rm(profile, { recursive: true, force: true })
}
