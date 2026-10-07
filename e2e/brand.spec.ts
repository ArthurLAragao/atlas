import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

test('marca legível, proporcional e navegável nos dois temas e tamanhos de tela', async ({
  page,
}) => {
  await page.goto('/preferencias')
  await mkdir('.vercel/logo-validation', { recursive: true })
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Tema', { exact: true }).selectOption(theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      for (const fontSize of ['100%', '200%']) {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = size
        }, fontSize)
        const brand = page.getByRole('link', {
          name: 'Atlas - início',
          exact: true,
        })
        await expect(brand).toBeVisible()
        const image = brand.locator('img')
        expect(
          await image.evaluate(
            (element) =>
              element instanceof HTMLImageElement &&
              element.complete &&
              element.naturalWidth > 0,
          ),
        ).toBe(true)
        const bounds = await image.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width).toBe(bounds!.height)
        const linkBounds = await brand.boundingBox()
        expect(linkBounds!.height).toBeGreaterThanOrEqual(44)
        const actionBounds = await page
          .locator('.toolbar-actions > a')
          .first()
          .boundingBox()
        expect(actionBounds).not.toBeNull()
        const overlapsVertically =
          linkBounds!.y < actionBounds!.y + actionBounds!.height &&
          actionBounds!.y < linkBounds!.y + linkBounds!.height
        if (overlapsVertically)
          expect(actionBounds!.x).toBeGreaterThanOrEqual(
            linkBounds!.x + linkBounds!.width,
          )
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
      }
      await page.locator('html').evaluate((root) => {
        root.style.fontSize = ''
      })
      await page
        .locator('.toolbar')
        .screenshot({ path: `.vercel/logo-validation/${theme}-${width}.png` })
    }
    expect(
      (await new AxeBuilder({ page }).include('.brand').analyze()).violations,
    ).toEqual([])
  }
  await page.locator('html').evaluate((root) => {
    root.style.fontSize = ''
  })
  const brand = page.getByRole('link', { name: 'Atlas - início', exact: true })
  await brand.focus()
  await expect(brand).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
})

test('ícones opacos, marca preservada na área segura e favicons disponíveis offline', async ({
  page,
  context,
}) => {
  await page.goto('/preferencias')
  for (const path of [
    '/icons/atlas-180.png',
    '/icons/atlas-192.png',
    '/icons/atlas-512.png',
    '/icons/atlas-maskable-512.png',
  ]) {
    const response = await page.request.get(path)
    expect(response.ok()).toBe(true)
    const { data, info } = await sharp(await response.body())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let foreground = 0
    let transparent = 0
    let maximumRadius = 0
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * info.channels
        if (data[offset + 3] !== 255) transparent++
        const different = [0, 1, 2].some(
          (channel) => data[offset + channel] !== data[channel],
        )
        if (different) {
          foreground++
          maximumRadius = Math.max(
            maximumRadius,
            Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2),
          )
        }
      }
    }
    expect(foreground).toBeGreaterThan(info.width * info.height * 0.1)
    expect(transparent).toBe(0)
    if (path.includes('maskable'))
      expect(maximumRadius).toBeLessThanOrEqual(204.8)
  }
  await expect(
    page.getByText('App preparado para recarga offline neste navegador.'),
  ).toBeVisible({ timeout: 30000 })
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  for (const path of [
    '/icons/atlas.svg',
    '/favicon.svg',
    '/favicon.ico',
    '/icons/atlas-maskable-512.png',
  ]) {
    expect(
      await page.evaluate(async (url) => {
        const response = await fetch(url)
        return response.ok && (await response.arrayBuffer()).byteLength > 0
      }, path),
    ).toBe(true)
  }
})
