import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { load, JSON_SCHEMA } from 'js-yaml'

type SeedReport = { week: string; items: { title: string; topics: string[]; relevance: string }[] }

function latestReport(): SeedReport {
  const dir = path.join(process.cwd(), 'content/radar')
  const file = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort().at(-1)!
  const { data } = matter(fs.readFileSync(path.join(dir, file), 'utf8'), {
    engines: { yaml: (s: string) => load(s, { schema: JSON_SCHEMA }) as object },
  })
  return data as SeedReport
}

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

test('los filtros no pierden teclas ni clics con latencia de red', async ({ page }) => {
  await page.route(/_rsc=/, async (route) => {
    await new Promise((r) => setTimeout(r, 250))
    await route.continue()
  })
  await page.goto('/explore')
  await expect(page.getByTestId('node-card').first()).toBeVisible()
  const search = page.getByPlaceholder('Buscar conceptos y herramientas…')
  await search.pressSequentially('transformer', { delay: 90 })
  await expect(search).toHaveValue('transformer')
  await search.fill('')
  await page.getByRole('button', { name: 'Herramienta', exact: true }).click()
  await page.getByRole('button', { name: 'Modelo', exact: true }).click()
  await expect(page).toHaveURL(/kind=tool,model/)
})

test('referentes filtra por idioma y lo refleja en la URL', async ({ page }) => {
  await page.goto('/people')
  const cards = page.getByTestId('person-card')
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  await page.getByRole('button', { name: 'Español', exact: true }).click()
  await expect(page).toHaveURL(/lang=es/)
  await expect.poll(() => cards.count()).toBeLessThan(total)
  for (const card of await cards.all()) await expect(card).toHaveAttribute('data-languages', /es/)
})

test('referentes filtra por tema desde la URL', async ({ page }) => {
  await page.goto('/people')
  const cards = page.getByTestId('person-card')
  await expect(cards.first()).toBeVisible()
  const total = await cards.count()
  await page.goto('/people?topic=neural-network')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeLessThan(total)
  await expect(page.getByRole('button', { name: 'Quitar Redes neuronales' })).toBeVisible()
})

test('referentes tolera parámetros inválidos', async ({ page }) => {
  await page.goto('/people?lang=fr&topic=nope&platform=tiktok')
  await expect(page.getByTestId('person-card').first()).toBeVisible()
})

test('el perfil muestra los recursos destacados', async ({ page }) => {
  await page.goto('/people/andrej-karpathy')
  await expect(page.getByRole('heading', { name: 'Recursos destacados' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Let's build GPT/ })).toBeVisible()
})

test('la ficha muestra quién habla de esto', async ({ page }) => {
  await page.goto('/node/neural-network')
  const voices = page.getByTestId('voices-for-topic')
  await expect(voices).toBeVisible()
  await expect(voices).toContainText('3Blue1Brown')
})

test('el selector de temas acepta el id o un nombre parcial con Enter', async ({ page }) => {
  await page.goto('/people')
  await expect(page.getByTestId('person-card').first()).toBeVisible()
  const input = page.getByLabel('Agregar tema')
  await input.fill('llm')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Quitar Modelos de lenguaje grandes (LLM)' })).toBeVisible()
  await expect(page).toHaveURL(/topic=llm/)
  await input.fill('zzzz')
  await input.press('Enter')
  await expect(page.getByText('Sin coincidencias')).toBeVisible()
})

test('el radar lista los informes y abre el más reciente', async ({ page }) => {
  const report = latestReport()
  await page.goto('/')
  await page.getByRole('link', { name: 'Radar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Radar', level: 1 })).toBeVisible()
  await page.getByTestId('report-link').first().getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/radar/${report.week}$`))
  await expect(page.getByRole('heading', { name: 'Resumen de la semana' })).toBeVisible()
  await expect(page.getByTestId('report-item')).toHaveCount(report.items.length)
  await expect(page.getByRole('heading', { name: 'Cambios en el catálogo' })).toBeVisible()
})

test('el dashboard muestra esta semana en IA', async ({ page }) => {
  await page.goto('/')
  const block = page.getByTestId('this-week')
  await expect(block.getByRole('heading', { name: 'Esta semana en IA' })).toBeVisible()
  await expect(block.getByTestId('report-item').first()).toBeVisible()
})

test('la ficha de un nodo mencionado muestra menciones recientes', async ({ page }) => {
  const [first] = latestReport().items
  await page.goto(`/node/${first.topics[0]}`)
  await expect(page.getByTestId('recent-mentions')).toContainText(first.title)
})
