import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { invites, memberships } from '@/lib/db/schema'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, createGroup } from '@/lib/groups'
import {
  createEmailInvites, createLinkInvite, findInvite, hashToken, listInvites, newToken, redeemInvite, revokeInvite,
} from '@/lib/invites'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const now = new Date('2026-10-19T12:00:00Z')
const day = 24 * 60 * 60 * 1000
const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

async function setup() {
  const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
  const group = await createGroup(db, g, 'Taller')
  return { g, group }
}

describe('tokens', () => {
  it('son de 32 bytes en base64url y solo se guarda su hash', async () => {
    const t = newToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, {}, now)
    const rows = await db.select().from(invites)
    expect(rows[0].tokenHash).toBe(hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
  })
})

describe('crear invitaciones', () => {
  it('un enlace vence por defecto a los 14 días', async () => {
    const { g, group } = await setup()
    await createLinkInvite(db, g, group.id, {}, now)
    const [row] = await listInvites(db, g, group.id)
    expect(row.expiresAt.getTime() - now.getTime()).toBe(14 * day)
    expect(row.maxUses).toBeNull()
  })
  it('acepta de 1 a 90 días y un máximo de usos positivo', async () => {
    const { g, group } = await setup()
    await expect(createLinkInvite(db, g, group.id, { days: 0 }, now)).rejects.toBeInstanceOf(InputError)
    await expect(createLinkInvite(db, g, group.id, { days: 91 }, now)).rejects.toBeInstanceOf(InputError)
    await expect(createLinkInvite(db, g, group.id, { maxUses: 0 }, now)).rejects.toBeInstanceOf(InputError)
    await createLinkInvite(db, g, group.id, { days: 90, maxUses: 30 }, now)
  })
  it('por correo: una invitación de un solo uso por correo, sin repetidos y en minúsculas', async () => {
    const { g, group } = await setup()
    const out = await createEmailInvites(db, g, group.id, 'Ana@Gmail.com, beto@x.com\nana@gmail.com ; ', now)
    expect(out.map((o) => o.email)).toEqual(['ana@gmail.com', 'beto@x.com'])
    const rows = await listInvites(db, g, group.id)
    expect(rows.every((r) => r.kind === 'email' && r.maxUses === 1)).toBe(true)
  })
  it('rechaza correos mal escritos o más de 50', async () => {
    const { g, group } = await setup()
    await expect(createEmailInvites(db, g, group.id, 'ana@gmail.com, no-es-correo', now)).rejects.toBeInstanceOf(InputError)
    const many = Array.from({ length: 51 }, (_, i) => `a${i}@x.com`).join(',')
    await expect(createEmailInvites(db, g, group.id, many, now)).rejects.toBeInstanceOf(InputError)
  })
  it('otro guía no puede crear, listar ni revocar invitaciones del grupo', async () => {
    const { g, group } = await setup()
    const { id } = await createLinkInvite(db, g, group.id, {}, now)
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(createLinkInvite(db, other, group.id, {}, now)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listInvites(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(revokeInvite(db, other, group.id, id)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('canjear', () => {
  it('un enlace válido suma al alumno y cuenta un uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 2 }, now)
    const s = await seedUser(db)
    expect(await redeemInvite(db, { token, userId: s.id, email: s.email }, now)).toEqual({ ok: true, groupId: group.id })
    expect(await db.select().from(memberships)).toHaveLength(1)
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('quien ya era miembro no gasta otro uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    const s = await seedUser(db)
    await redeemInvite(db, { token, userId: s.id, email: s.email }, now)
    expect(await redeemInvite(db, { token, userId: s.id, email: s.email }, now)).toEqual({ ok: true, groupId: group.id })
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('rechaza un enlace vencido, revocado, agotado, de un grupo archivado o desconocido', async () => {
    const { g, group } = await setup()
    const s = await seedUser(db)
    const later = new Date(now.getTime() + 15 * day)
    const expired = await createLinkInvite(db, g, group.id, {}, now)
    expect(await redeemInvite(db, { token: expired.token, userId: s.id, email: s.email }, later)).toEqual({ ok: false, reason: 'expired' })

    const revoked = await createLinkInvite(db, g, group.id, {}, now)
    await revokeInvite(db, g, group.id, revoked.id)
    expect(await redeemInvite(db, { token: revoked.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'revoked' })

    const one = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    await redeemInvite(db, { token: one.token, userId: (await seedUser(db)).id, email: 'x@x.com' }, now)
    expect(await redeemInvite(db, { token: one.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'exhausted' })

    expect(await redeemInvite(db, { token: newToken(), userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'not-found' })

    const live = await createLinkInvite(db, g, group.id, {}, now)
    await archiveGroup(db, g, group.id)
    expect(await redeemInvite(db, { token: live.token, userId: s.id, email: s.email }, now)).toEqual({ ok: false, reason: 'archived' })
  })
  it('una invitación por correo solo sirve con ese correo', async () => {
    const { g, group } = await setup()
    const [inv] = await createEmailInvites(db, g, group.id, 'ana@gmail.com', now)
    const other = await seedUser(db, { email: 'otra@gmail.com' })
    expect(await redeemInvite(db, { token: inv.token, userId: other.id, email: other.email }, now)).toEqual({ ok: false, reason: 'wrong-email' })
    const ana = await seedUser(db, { email: 'ana@gmail.com' })
    expect(await redeemInvite(db, { token: inv.token, userId: ana.id, email: 'Ana@Gmail.com' }, now)).toEqual({ ok: true, groupId: group.id })
  })
  it('de dos canjes en paralelo por el último uso, solo uno entra', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    const a = await seedUser(db)
    const b = await seedUser(db)
    const results = await Promise.all([
      redeemInvite(db, { token, userId: a.id, email: a.email }, now),
      redeemInvite(db, { token, userId: b.id, email: b.email }, now),
    ])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(await db.select().from(memberships)).toHaveLength(1)
  })
  it('el mismo alumno canjeando dos veces en paralelo entra una vez y gasta un solo uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 2 }, now)
    const s = await seedUser(db)
    const results = await Promise.all([
      redeemInvite(db, { token, userId: s.id, email: s.email }, now),
      redeemInvite(db, { token, userId: s.id, email: s.email }, now),
    ])
    expect(results).toEqual([{ ok: true, groupId: group.id }, { ok: true, groupId: group.id }])
    expect(await db.select().from(memberships)).toHaveLength(1)
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('el mismo alumno en paralelo con un enlace de un solo uso: ambos ok, un uso', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, { maxUses: 1 }, now)
    const s = await seedUser(db)
    const results = await Promise.all([
      redeemInvite(db, { token, userId: s.id, email: s.email }, now),
      redeemInvite(db, { token, userId: s.id, email: s.email }, now),
    ])
    expect(results).toEqual([{ ok: true, groupId: group.id }, { ok: true, groupId: group.id }])
    expect(await db.select().from(memberships)).toHaveLength(1)
    expect((await listInvites(db, g, group.id))[0].uses).toBe(1)
  })
  it('findInvite devuelve el grupo y el nombre del guía', async () => {
    const { g, group } = await setup()
    const { token } = await createLinkInvite(db, g, group.id, {}, now)
    const found = await findInvite(db, token)
    expect(found?.group.name).toBe('Taller')
    expect(found?.guideName).toBe('Profe')
    expect(await findInvite(db, 'inventado')).toBeUndefined()
  })
})
