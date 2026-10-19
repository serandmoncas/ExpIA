import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import type { Mail } from '@/lib/email'
import { createAuth } from '@/lib/auth-config'
import { parseAdminEmails, type Actor } from '@/lib/access'
import { createGroup, grantGuide } from '@/lib/groups'
import { createLinkInvite, INVITE_COOKIE } from '@/lib/invites'
import { readCookie } from '@/lib/registration'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
let auth: ReturnType<typeof createAuth>
const BASE = 'http://localhost:3000'

beforeAll(async () => {
  db = await testDb()
  auth = createAuth({
    db, mailer: async (m) => { sent.push(m) }, admins: parseAdminEmails('admin@x.com'), baseURL: BASE, secret: 'a'.repeat(40),
  })
})
beforeEach(async () => { await resetDb(db); sent = [] })

// Pide el enlace mágico y lo abre, como haría el navegador
async function signIn(email: string, cookie = '') {
  await auth.handler(new Request(`${BASE}/api/auth/sign-in/magic-link`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie, origin: BASE }, body: JSON.stringify({ email, callbackURL: '/cuenta' }),
  }))
  const mail = sent.at(-1)
  if (!mail) return { mailed: false, location: null as string | null }
  const url = mail.text.match(/https?:\/\/\S+/)![0]
  const res = await auth.handler(new Request(url, { headers: { cookie } }))
  return { mailed: true, location: res.headers.get('location') }
}

const users = () => db.select().from(user)

describe('registro solo por invitación', () => {
  it('a un correo sin invitación no se le envía el enlace ni se crea la cuenta', async () => {
    expect(await signIn('extrano@x.com')).toEqual({ mailed: false, location: null })
    expect(await users()).toHaveLength(0)
  })
  it('un administrador entra sin invitación, aunque escriba con mayúsculas', async () => {
    const r = await signIn('Admin@X.com')
    expect(r.location).toBe(`${BASE}/cuenta`)
    expect((await users()).map((u) => u.email)).toEqual(['admin@x.com'])
  })
  it('un correo autorizado como guía entra y queda como guía', async () => {
    const admin: Actor = { ...(await seedUser(db, { email: 'admin@x.com' })), isAdmin: true }
    await grantGuide(db, admin, 'Guia@X.com')
    const r = await signIn('guia@x.com')
    expect(r.location).toBe(`${BASE}/cuenta`)
    const [g] = await db.select().from(user).where(eq(user.email, 'guia@x.com'))
    expect(g.isGuide).toBe(true)
  })
  it('con la cookie de una invitación válida se crea la cuenta', async () => {
    const g: Actor = { ...(await seedUser(db, { isGuide: true })), isAdmin: false }
    const group = await createGroup(db, g, 'Taller')
    const { token } = await createLinkInvite(db, g, group.id, {})
    const r = await signIn('alumno@x.com', `${INVITE_COOKIE}=${token}`)
    expect(r.location).toBe(`${BASE}/cuenta`)
    expect((await users()).some((u) => u.email === 'alumno@x.com')).toBe(true)
  })
  it('con la cookie de una invitación inválida no se envía nada', async () => {
    expect(await signIn('alumno@x.com', `${INVITE_COOKIE}=inventado`)).toEqual({ mailed: false, location: null })
  })
  it('quien ya tiene cuenta siempre puede pedir su enlace', async () => {
    await seedUser(db, { email: 'ya@x.com' })
    expect((await signIn('ya@x.com')).location).toBe(`${BASE}/cuenta`)
  })
})

describe('readCookie', () => {
  it('lee una cookie por nombre', () => {
    expect(readCookie('a=1; expia_invite=abc; b=2', 'expia_invite')).toBe('abc')
    expect(readCookie(null, 'expia_invite')).toBeNull()
    expect(readCookie('a=1', 'expia_invite')).toBeNull()
  })
})
