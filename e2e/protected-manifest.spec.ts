import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('manifest usa a sessão do navegador sem liberar recurso protegido', async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error('URL local de teste não configurada.')
  await context.addCookies([
    { name: 'atlas_access_test', value: 'fictitious', url: baseURL },
  ])
  let manifestWithSession = false
  await page.route('**/manifest.webmanifest', async (route) => {
    const cookie = await route.request().headerValue('cookie')
    const authorized = cookie?.includes('atlas_access_test=fictitious') ?? false
    if (!authorized) {
      await route.fulfill({ status: 401, body: 'Acesso necessário' })
      return
    }
    manifestWithSession = true
    await route.continue()
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Hoje', exact: true }),
  ).toBeVisible()
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'crossorigin',
    'use-credentials',
  )
  expect(
    await page.evaluate(async () => {
      const response = await fetch('/manifest.webmanifest', {
        credentials: 'omit',
        cache: 'no-store',
      })
      return response.status
    }),
  ).toBe(401)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Page.enable')
  const result = await cdp.send('Page.getAppManifest')
  expect(result.errors).toEqual([])
  if (!result.data) throw new Error('Manifest não retornou conteúdo.')
  expect(JSON.parse(result.data)).toMatchObject({ name: 'Atlas', scope: '/' })
  expect(manifestWithSession).toBe(true)
})
