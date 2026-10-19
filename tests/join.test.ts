import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { memberships } from '@/lib/db/schema'
import type { Actor } from '@/lib/access'
import { createGroup } from '@/lib/groups'
import { createLinkInvite, INVITE_COOKIE } from '@/lib/invites'
import { INVITE_MESSAGES, joinRedeem, joinStart, parseInviteProblem } from '@/lib/join'
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

describe('unirse a un grupo', () => {
  it('entrar guarda el token en una cookie httpOnly y manda a iniciar sesión', () => {
    const res = joinStart(new Request(`${BASE}/unirse/abc/entrar`), 'abc')
    expect(res.headers.get('location')).toBe(`${BASE}/entrar?next=%2Funirse%2Fabc%2Fcanjear`)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toContain(`${INVITE_COOKIE}=abc`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=3600')
  })
  it('canjear sin sesión vuelve a la página de la invitación', async () => {
    const res = await joinRedeem(new Request(`${BASE}/unirse/t/canjear`), 't', { db, actor: null })
    expect(res.headers.get('location')).toBe(`${BASE}/unirse/t`)
  })
  it('canjear con sesión suma al grupo, borra la cookie y lleva a la cuenta', async () => {
    const { token, group } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(new Request(`${BASE}/unirse/${token}/canjear`), token, { db, actor: s })
    expect(res.headers.get('location')).toBe(`${BASE}/cuenta?unido=${group.id}`)
    expect(res.headers.get('set-cookie')).toContain(`${INVITE_COOKIE}=;`)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('canjear por POST redirige con 303 para que el navegador pase a GET', async () => {
    const { token, group } = await invite()
    const s = asActor(await seedUser(db))
    const res = await joinRedeem(new Request(`${BASE}/unirse/${token}/canjear`, { method: 'POST' }), token, { db, actor: s })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${BASE}/cuenta?unido=${group.id}`)
  })
  it('un enlace agotado devuelve a la invitación con el motivo', async () => {
    const { token } = await invite(1)
    await joinRedeem(new Request(`${BASE}/x`), token, { db, actor: asActor(await seedUser(db)) })
    const res = await joinRedeem(new Request(`${BASE}/x`), token, { db, actor: asActor(await seedUser(db)) })
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
