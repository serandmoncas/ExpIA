import { test, expect } from '@playwright/test'

test('el dashboard muestra tendencias', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'ExpIA', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tomando fuerza' })).toBeVisible()
})

test('explorar filtra por tipo y lo refleja en la URL', async ({ page }) => {
  await page.goto('/explore')
  const cards = page.getByTestId('node-card')
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  expect(total).toBeGreaterThan(10)
  await page.getByRole('button', { name: 'Herramienta', exact: true }).click()
  await expect(page).toHaveURL(/kind=tool/)
  await expect.poll(() => cards.count()).toBeLessThan(total)
  for (const card of await cards.all()) await expect(card).toContainText('Herramienta')
})

test('explorar tolera parámetros inválidos', async ({ page }) => {
  await page.goto('/explore?level=foo&from=abc&cat=nope&to=99999')
  await expect(page.getByTestId('node-card').first()).toBeVisible()
})

test('la ficha muestra la ruta de prerrequisitos', async ({ page }) => {
  await page.goto('/node/rag')
  await expect(page.getByRole('heading', { name: 'Ruta sugerida' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Embeddings' }).first()).toBeVisible()
})

test('la línea de tiempo enlaza a las fichas', async ({ page }) => {
  await page.goto('/timeline')
  await expect(page.locator('svg a[href="/node/transformer"]')).toHaveCount(1)
})

test('el mapa dibuja los nodos', async ({ page }) => {
  await page.goto('/graph')
  await expect.poll(() => page.locator('.react-flow__node').count()).toBeGreaterThan(10)
})

test('la línea de tiempo abre mostrando lo más reciente', async ({ page }) => {
  await page.goto('/timeline')
  const scroller = page.getByTestId('timeline-scroll')
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
})
