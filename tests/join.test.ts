import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import type { Actor } from '@/lib/access'
import { createGroup } from '@/lib/groups'
import { createLinkInvite, INVITE_COOKIE } from '@/lib/invites'
import { INVITE_MESSAGES, isSameOriginPost, joinRedeem, joinStart, parseInviteProblem } from '@/lib/join'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const BASE = 'http://localhost:3100'
const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

async function invite(maxUses: number | null = null) {
  const g = asActor(await seedUser(db, { isGuide: true }))
  const group = await createGroup(db, g, 'Taller')
  return { group, ...(await createLinkInvite(db, g, group.id, { maxUses })) }
}

const SAME = { 'sec-fetch-site': 'same-origin' }
const post = (path: string, headers: Record<string, string> = SAME) => new Request(`${BASE}${path}`, { method: 'POST', headers })
const get = (path: string, cookie?: string) => new Request(`${BASE}${path}`, { headers: cookie ? { cookie } : {} })
const cookieFor = (t: string) => `${INVITE_COOKIE}=${t}`

describe('isSameOriginPost', () => {
  const r = (headers: Record<string, string>) => new Request(`${BASE}/unirse/t/canjear`, { method: 'POST', headers })
  it('acepta same-origin', () => expect(isSameOriginPost(r({ 'sec-fetch-site': 'same-origin' }))).toBe(true))
  it.each(['cross-site', 'same-site', 'none'])('rechaza Sec-Fetch-Site %s', (v) => expect(isSameOriginPost(r({ 'sec-fetch-site': v }))).toBe(false))
  it('sin Sec-Fetch-Site acepta un Origin igual al del sitio', () => expect(isSameOriginPost(r({ origin: BASE }))).toBe(true))
  it('sin Sec-Fetch-Site rechaza un Origin ajeno', () => expect(isSameOriginPost(r({ origin: 'https://malo.example' }))).toBe(false))
  it('Origin "null" se rechaza', () => expect(isSameOriginPost(r({ origin: 'null' }))).toBe(false))
  it('sin ninguna de las dos cabeceras (cliente que no es navegador) se acepta', () => expect(isSameOriginPost(r({}))).toBe(true))
})

describe('unirse a un grupo', () => {
  it('entrar (POST del mismo sitio) guarda el token en una cookie httpOnly y manda a iniciar sesión', () => {
    const res = joinStart(post('/unirse/abc/entrar'), 'abc')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${BASE}/entrar?next=%2Funirse%2Fabc%2Fcanjear`)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${INVITE_COOKIE}=abc`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=3600')
  })
  it('entrar por GET no guarda cookie y vuelve a la invitación', () => {
    const res = joinStart(get('/unirse/abc/entrar'), 'abc')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/abc`)
  })
  it('entrar desde otro sitio responde 403 y no guarda cookie', () => {
    const res = joinStart(post('/unirse/abc/entrar', { 'sec-fetch-site': 'cross-site' }), 'abc')
    expect(res.status).toBe(403)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
  it('canjear sin sesión vuelve a la página de la invitación', async () => {
    const res = await joinRedeem(get('/unirse/t/canjear', cookieFor('t')), 't', { db, actor: null })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/t`)
  })
  it('canjear por GET con la cookie de esa invitación suma al grupo, borra la cookie y lleva a la cuenta', async () => {
    const { token, group } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(get(`/unirse/${token}/canjear`, cookieFor(token)), token, { db, actor: s })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/cuenta?unido=${group.id}`)
    expect(res.headers.get('set-cookie')).toContain(`${INVITE_COOKIE}=;`)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('canjear por GET sin la cookie no une a nadie y manda a confirmar a la invitación', async () => {
    const { token } = await invite(1)
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(get(`/unirse/${token}/canjear`), token, { db, actor: s })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/${token}`)
    expect(await db.select().from(memberships)).toHaveLength(0)
    // el cupo sigue intacto: otra persona aún puede usar el enlace de un solo uso
    const ok = await joinRedeem(post(`/unirse/${token}/canjear`), token, { db, actor: asActor(await seedUser(db)) })
    expect(ok.headers.get('location')).toMatch(/\/cuenta\?unido=/)
  })
  it('canjear por GET con la cookie de OTRA invitación tampoco une', async () => {
    const { token } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(get(`/unirse/${token}/canjear`, cookieFor('otro')), token, { db, actor: s })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/${token}`)
    expect(await db.select().from(memberships)).toHaveLength(0)
  })
  it('canjear por POST del mismo sitio redirige con 303 para que el navegador pase a GET', async () => {
    const { token, group } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(post(`/unirse/${token}/canjear`), token, { db, actor: s })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${BASE}/cuenta?unido=${group.id}`)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('canjear por POST desde otro sitio responde 403 y no une', async () => {
    const { token } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(post(`/unirse/${token}/canjear`, { 'sec-fetch-site': 'cross-site' }), token, { db, actor: s })
    expect(res.status).toBe(403)
    expect(await db.select().from(memberships)).toHaveLength(0)
  })
  it('canjear por POST con Origin de otro sitio responde 403 y no une', async () => {
    const { token } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(post(`/unirse/${token}/canjear`, { origin: 'https://malo.example' }), token, { db, actor: s })
    expect(res.status).toBe(403)
    expect(await db.select().from(memberships)).toHaveLength(0)
  })
  it('un enlace agotado devuelve a la invitación con el motivo', async () => {
    const { token } = await invite(1)
    await joinRedeem(post('/x'), token, { db, actor: asActor(await seedUser(db)) })
    const res = await joinRedeem(post('/x'), token, { db, actor: asActor(await seedUser(db)) })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/${token}?error=exhausted`)
  })
  it('hay un mensaje en español para cada problema', () => {
    expect(INVITE_MESSAGES.expired).toBe('Este enlace ya no es válido. Pídele uno nuevo a tu guía.')
    expect(Object.keys(INVITE_MESSAGES).sort()).toEqual(['archived', 'exhausted', 'expired', 'not-found', 'revoked', 'wrong-email'])
  })
  it('parseInviteProblem solo acepta motivos conocidos', () => {
    expect(parseInviteProblem('expired')).toBe('expired')
    expect(parseInviteProblem('wrong-email')).toBe('wrong-email')
    for (const v of ['__proto__', 'constructor', 'toString', '', undefined, 'otra-cosa']) expect(parseInviteProblem(v)).toBeNull()
  })
})
