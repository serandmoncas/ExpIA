import { expect, test, type Browser, type Page } from '@playwright/test'

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const mail = (who: string) => `${who}-${run}@e2e.test`

async function loginAs(browser: Browser, email: string, next: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto(`/api/test/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)
  return page
}

async function authorizeGuide(browser: Browser, email: string) {
  const admin = await loginAs(browser, 'admin@e2e.test', '/admin')
  await admin.getByLabel('Correo del guía').fill(email)
  await admin.getByRole('button', { name: 'Autorizar' }).click()
  await expect(admin.getByTestId('guide-row').filter({ hasText: email })).toBeVisible()
}

test('un guía crea un grupo, un alumno se une con su avance local y el guía lo ve', async ({ browser }) => {
  const guideEmail = mail('guia')
  await authorizeGuide(browser, guideEmail)

  const guide = await loginAs(browser, guideEmail, '/guia')
  await guide.getByLabel('Nombre del grupo').fill('Taller E2E')
  await guide.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(guide.getByRole('heading', { name: 'Taller E2E' })).toBeVisible()
  const groupUrl = guide.url()
  await guide.getByLabel('Ruta curada').selectOption('fundamentos')
  await guide.getByRole('button', { name: 'Asignar' }).click()
  // Esperar a que la asignación termine (aparece "Quitar") antes de crear el enlace
  await expect(guide.getByRole('button', { name: 'Quitar' })).toBeVisible()
  await guide.getByRole('button', { name: 'Crear enlace' }).click()
  const inviteUrl = (await guide.getByTestId('new-invite').textContent())!.trim()
  const invitePath = new URL(inviteUrl).pathname

  // El alumno ya tenía avance en el navegador antes de tener cuenta
  const student = await (await browser.newContext()).newPage()
  await student.goto('/')
  await student.evaluate(() => localStorage.setItem('expia.learned', JSON.stringify(['machine-learning'])))
  await student.goto(`/api/test/login?email=${encodeURIComponent(mail('alumno'))}&next=${encodeURIComponent(invitePath)}`)
  await expect(student.getByRole('button', { name: 'Unirme al grupo' })).toBeVisible()
  // Ver la invitación no basta: Next precarga los enlaces, y unirse debe requerir un clic
  await student.waitForTimeout(2000)
  await student.goto('/cuenta')
  await expect(student.getByTestId('student-group')).toHaveCount(0)
  await student.goto(invitePath)
  await student.getByRole('button', { name: 'Unirme al grupo' }).click()
  await expect(student.getByTestId('student-group').filter({ hasText: 'Taller E2E' })).toBeVisible()

  await student.getByRole('button', { name: /Traer tu avance de este navegador \(1 nodo\)/ }).click()
  await expect(student.getByTestId('import-offer')).toBeHidden()

  await student.goto('/node/neural-network')
  const toggle = student.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  await guide.goto(groupUrl)
  await expect(guide.getByTestId('progress-row')).toContainText('2 de 10')
})

test('otro guía recibe 404 en un grupo ajeno', async ({ browser }) => {
  const owner = mail('dueno')
  const intruder = mail('intruso')
  await authorizeGuide(browser, owner)
  await authorizeGuide(browser, intruder)
  const page = await loginAs(browser, owner, '/guia')
  await page.getByLabel('Nombre del grupo').fill('Privado')
  await page.getByRole('button', { name: 'Crear grupo' }).click()
  await expect(page.getByRole('heading', { name: 'Privado' })).toBeVisible()
  const other = await loginAs(browser, intruder, '/guia')
  const res = await other.goto(page.url())
  expect(res?.status()).toBe(404)
})

test('sin sesión, /guia lleva a entrar', async ({ page }) => {
  await page.goto('/guia')
  await expect(page).toHaveURL(/\/entrar\?next=%2Fguia|\/entrar\?next=\/guia/)
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible()
})

test('si el servidor falla al guardar, la marca vuelve atrás y avisa', async ({ browser }) => {
  const page = await loginAs(browser, mail('offline'), '/cuenta')
  await page.route('**/api/learned', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500 }) : route.continue()))
  await page.goto('/node/llm')
  const toggle = page.getByTestId('learned-toggle').first()
  await expect(toggle).toHaveAttribute('data-ready', 'true')
  await toggle.click()
  await expect(page.getByTestId('learned-error')).toHaveText('No se pudo guardar. Inténtalo de nuevo.')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
})

test('si falla la carga del avance, Reintentar lo recupera', async ({ browser }) => {
  const page = await loginAs(browser, mail('reintento'), '/cuenta')
  // La carga puede pedirse más de una vez al hidratar: se falla hasta que el alumno pulse Reintentar
  let failing = true
  await page.route('**/api/learned', (route) =>
    failing && route.request().method() === 'GET' ? route.fulfill({ status: 500 }) : route.continue(),
  )
  await page.goto('/node/llm')
  await expect(page.getByTestId('learned-error')).toHaveText(/No se pudo cargar tu avance\./)
  failing = false
  await page.getByTestId('learned-retry').click()
  await expect(page.getByTestId('learned-toggle').first()).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('learned-error')).toBeHidden()
})

test('un enlace inventado muestra que no es válido', async ({ page }) => {
  await page.goto('/unirse/esto-no-existe')
  await expect(page.getByTestId('invite-invalid')).toHaveText('Este enlace ya no es válido. Pídele uno nuevo a tu guía.')
})

test('/entrar con un error que es una clave de Object.prototype muestra el mensaje genérico', async ({ page }) => {
  for (const error of ['__proto__', 'constructor', 'toString']) {
    const res = await page.goto(`/entrar?error=${error}`)
    expect(res?.status()).toBe(200)
    await expect(page.getByText('No se pudo iniciar sesión. Inténtalo de nuevo.')).toBeVisible()
  }
})

test('si falla el envío del enlace mágico, el formulario avisa en lugar de decir "Revisa tu correo"', async ({ page }) => {
  await page.route('**/api/auth/sign-in/magic-link', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
  await page.goto('/entrar')
  await page.getByLabel('O recibe un enlace en tu correo').fill('alguien@e2e.test')
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByTestId('magic-error')).toHaveText('No se pudo enviar el enlace. Inténtalo de nuevo.')
  await expect(page.getByTestId('magic-sent')).toHaveCount(0)
})

test('el enlace mágico muestra "Revisa tu correo" aunque el correo no tenga cuenta', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('O recibe un enlace en tu correo').fill(`nadie-${run}@e2e.test`)
  await page.getByRole('button', { name: 'Enviarme el enlace' }).click()
  await expect(page.getByTestId('magic-sent')).toBeVisible()
})
