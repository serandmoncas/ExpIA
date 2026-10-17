import { test, expect, type Page } from '@playwright/test'

async function toggleOn(page: Page, scope = page.locator('body')) {
  const toggle = scope.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  return toggle
}

test('la ficha muestra preguntas de repaso con la respuesta oculta', async ({ page }) => {
  await page.goto('/node/rag')
  const review = page.getByTestId('review-questions')
  const first = review.locator('details').first()
  await expect(first).not.toHaveAttribute('open', '')
  await first.getByText('Ver respuesta').click()
  await expect(first).toHaveAttribute('open', '')
})

test('marcar un nodo como aprendido persiste al recargar', async ({ page }) => {
  await page.goto('/node/rag')
  await toggleOn(page)
  await expect(page.getByTestId('learned-toggle').first()).toHaveText('✓ Aprendido')
  await page.reload()
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('aria-pressed', 'true')
})

test('la ficha enlaza a aprender desde cero y a las rutas que la contienen', async ({ page }) => {
  await page.goto('/node/rag')
  await expect(page.getByRole('link', { name: /Aprender desde cero \(\d+ pasos\)/ })).toHaveAttribute('href', '/learn/rag')
  await expect(page.getByTestId('in-paths').getByRole('link', { name: 'Construir con LLMs' })).toBeVisible()
})

test('con localStorage bloqueado la ficha funciona en memoria', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError') } })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/node/rag')
  await toggleOn(page)
  expect(errors).toEqual([])
})

test('las rutas se listan, se abren y guardan el progreso', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Rutas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rutas de aprendizaje', level: 1 })).toBeVisible()
  await expect(page.getByTestId('path-card')).toHaveCount(4)
  await page.getByTestId('path-card').filter({ hasText: 'Fundamentos de IA' }).click()
  await expect(page).toHaveURL(/\/paths\/fundamentos$/)
  const first = page.getByTestId('path-step').first()
  await expect(first).toHaveAttribute('data-next', 'true')
  await toggleOn(page, first)
  await expect(page.getByTestId('path-step').nth(1)).toHaveAttribute('data-next', 'true')
  await expect(page.getByTestId('path-progress').first()).toContainText('1 de 10')
  await page.reload()
  await expect(page.getByTestId('path-progress').first()).toContainText('1 de 10')
})

test('un nodo aprendido aparece marcado en otras rutas y en su ficha', async ({ page }) => {
  await page.goto('/paths/construir-con-llms')
  await toggleOn(page, page.locator('[data-testid="path-step"][data-node="prompting"]'))
  await page.goto('/paths/ia-para-tu-negocio')
  await expect(page.locator('[data-node="prompting"]').getByTestId('learned-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/node/prompting')
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('aria-pressed', 'true')
})

test('la ruta generada lista los prerrequisitos antes de la meta', async ({ page }) => {
  await page.goto('/learn/rag')
  await expect(page.getByRole('heading', { name: /Aprender RAG/ })).toBeVisible()
  const nodes = await page.getByTestId('path-step').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')))
  expect(nodes.at(-1)).toBe('rag')
  expect(nodes.indexOf('embeddings')).toBeGreaterThanOrEqual(0)
  expect(nodes.indexOf('embeddings')).toBeLessThan(nodes.indexOf('vector-db'))
})

test('la ruta que asume otra muestra el aviso con enlace', async ({ page }) => {
  await page.goto('/paths/construir-un-agente')
  await expect(page.getByTestId('after-notice').getByRole('link', { name: 'Construir con LLMs' })).toHaveAttribute('href', '/paths/construir-con-llms')
})

test('marcar en una pestaña se refleja en otra', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  await a.goto('/paths/fundamentos')
  await b.goto('/paths/fundamentos')
  await expect(b.getByTestId('learned-toggle').first()).toHaveAttribute('data-ready', 'true')
  await toggleOn(a, a.getByTestId('path-step').first())
  await expect(b.getByTestId('path-step').first().getByTestId('learned-toggle')).toHaveAttribute('aria-pressed', 'true')
})

test('la ruta no produce errores de hidratación', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('/paths/fundamentos')
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('data-ready', 'true')
  expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([])
})

test('la portada sugiere rutas y luego el siguiente paso de la empezada', async ({ page }) => {
  await page.goto('/')
  const block = page.getByTestId('continue-learning')
  await expect(block.getByRole('heading', { name: 'Sigue aprendiendo' })).toBeVisible()
  await expect(block.getByRole('link', { name: 'Fundamentos de IA' })).toBeVisible()
  await page.goto('/paths/fundamentos')
  await toggleOn(page, page.getByTestId('path-step').first())
  await page.goto('/')
  await expect(block).toContainText('1 de 10')
  await expect(block.getByRole('link', { name: 'Redes neuronales', exact: false })).toHaveAttribute('href', '/node/neural-network')
})
