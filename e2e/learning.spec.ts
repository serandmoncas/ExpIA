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
