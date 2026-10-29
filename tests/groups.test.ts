import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, memberships, user } from '@/lib/db/schema'
import { getCatalog } from '@/lib/content/load'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import {
  archiveGroup, assignPath, claimGuideInvite, createGroup, getGroupForGuide, grantGuide, hasGuideInvite, leaveGroup,
  listAssignments, listGuideGroups, listGuides, listMembers, loadManagedGroup, removeMember, renameGroup, revokeGuide, unassignPath,
} from '@/lib/groups'
import { resetDb, seedUser, testDb } from './helpers/db'

const catalog = getCatalog()
let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }, isAdmin = false): Actor => ({ ...u, isAdmin })

async function guideWithGroup() {
  const g = asActor(await seedUser(db, { isGuide: true }))
  const group = await createGroup(db, g, 'Taller de IA')
  return { g, group }
}

describe('grupos', () => {
  it('un guía crea un grupo con nombre limpio', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    const group = await createGroup(db, g, '  Taller de IA  ')
    expect(group.name).toBe('Taller de IA')
    expect((await listGuideGroups(db, g)).map((x) => [x.name, x.members])).toEqual([['Taller de IA', 0]])
  })
  it('rechaza nombres vacíos o de más de 80 caracteres', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    await expect(createGroup(db, g, '   ')).rejects.toBeInstanceOf(InputError)
    await expect(createGroup(db, g, 'x'.repeat(81))).rejects.toBeInstanceOf(InputError)
  })
  it('quien no es guía no puede crear grupos', async () => {
    const s = asActor(await seedUser(db))
    await expect(createGroup(db, s, 'A')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('otro guía no puede ver, renombrar, archivar ni listar miembros de un grupo ajeno', async () => {
    const { group } = await guideWithGroup()
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(getGroupForGuide(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(renameGroup(db, other, group.id, 'B')).rejects.toBeInstanceOf(NotFoundError)
    await expect(archiveGroup(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listMembers(db, other, group.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(getGroupForGuide(db, other, 'no-existe')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('un grupo archivado se ve pero ya no se administra', async () => {
    const { g, group } = await guideWithGroup()
    await archiveGroup(db, g, group.id)
    expect((await getGroupForGuide(db, g, group.id)).archivedAt).not.toBeNull()
    await expect(loadManagedGroup(db, g, group.id)).rejects.toBeInstanceOf(NotFoundError)
  })
  it('el guía quita a un alumno y el alumno puede salir solo', async () => {
    const { g, group } = await guideWithGroup()
    const a = await seedUser(db)
    const b = await seedUser(db)
    await db.insert(memberships).values([{ groupId: group.id, userId: a.id }, { groupId: group.id, userId: b.id }])
    await removeMember(db, g, group.id, a.id)
    await leaveGroup(db, b.id, group.id)
    expect(await listMembers(db, g, group.id)).toEqual([])
  })
})

describe('asignaciones', () => {
  it('asigna una ruta curada y una generada, con fecha opcional', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-11-30', catalog)
    await assignPath(db, g, group.id, 'generated:llm', null, catalog)
    expect(await listAssignments(db, group.id)).toEqual([
      { pathRef: 'curated:fundamentos', dueDate: '2026-11-30' },
      { pathRef: 'generated:llm', dueDate: null },
    ])
  })
  it('asignar de nuevo la misma ruta actualiza la fecha', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', null, catalog)
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-12-01', catalog)
    expect(await listAssignments(db, group.id)).toEqual([{ pathRef: 'curated:fundamentos', dueDate: '2026-12-01' }])
  })
  it('rechaza una ruta que no existe o una fecha mal escrita', async () => {
    const { g, group } = await guideWithGroup()
    await expect(assignPath(db, g, group.id, 'curated:no-existe', null, catalog)).rejects.toBeInstanceOf(InputError)
    await expect(assignPath(db, g, group.id, 'curated:fundamentos', '30/11/2026', catalog)).rejects.toBeInstanceOf(InputError)
    await expect(assignPath(db, g, group.id, 'curated:fundamentos', '2026-02-30', catalog)).rejects.toBeInstanceOf(InputError)
    await expect(assignPath(db, g, group.id, 'curated:fundamentos', '2026-13-45', catalog)).rejects.toBeInstanceOf(InputError)
  })
  it('otro guía no puede asignar ni quitar rutas', async () => {
    const { g, group } = await guideWithGroup()
    await assignPath(db, g, group.id, 'curated:fundamentos', null, catalog)
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(assignPath(db, other, group.id, 'generated:llm', null, catalog)).rejects.toBeInstanceOf(NotFoundError)
    await expect(unassignPath(db, other, group.id, 'curated:fundamentos')).rejects.toBeInstanceOf(NotFoundError)
    await unassignPath(db, g, group.id, 'curated:fundamentos')
    expect(await listAssignments(db, group.id)).toEqual([])
  })
})

describe('guías', () => {
  it('el administrador autoriza un correo que todavía no tiene cuenta', async () => {
    const admin = asActor(await seedUser(db), true)
    await grantGuide(db, admin, ' Nueva@Guia.com ')
    expect(await hasGuideInvite(db, 'nueva@guia.com')).toBe(true)
    expect((await listGuides(db, admin)).pending).toEqual(['nueva@guia.com'])
  })
  it('al registrarse con ese correo queda como guía', async () => {
    const admin = asActor(await seedUser(db), true)
    await grantGuide(db, admin, 'nueva@guia.com')
    const u = await seedUser(db, { email: 'nueva@guia.com' })
    await claimGuideInvite(db, u)
    const [row] = await db.select().from(user).where(eq(user.id, u.id))
    expect(row.isGuide).toBe(true)
    expect(await hasGuideInvite(db, 'nueva@guia.com')).toBe(false)
  })
  it('autorizar a alguien que ya tiene cuenta lo vuelve guía al instante', async () => {
    const admin = asActor(await seedUser(db), true)
    const u = await seedUser(db, { email: 'ya@existe.com' })
    await grantGuide(db, admin, 'YA@existe.com')
    expect((await listGuides(db, admin)).active.map((x) => x.id)).toEqual([u.id])
  })
  it('quitar el rol archiva sus grupos y le impide administrarlos', async () => {
    const admin = asActor(await seedUser(db), true)
    const { g, group } = await guideWithGroup()
    await revokeGuide(db, admin, g.id)
    const [row] = await db.select().from(groups).where(eq(groups.id, group.id))
    expect(row.archivedAt).not.toBeNull()
    await expect(createGroup(db, { ...g, isGuide: false }, 'Otro')).rejects.toBeInstanceOf(NotFoundError)
  })
  it('solo el administrador autoriza o quita guías', async () => {
    const g = asActor(await seedUser(db, { isGuide: true }))
    await expect(grantGuide(db, g, 'x@y.com')).rejects.toBeInstanceOf(NotFoundError)
    await expect(revokeGuide(db, g, g.id)).rejects.toBeInstanceOf(NotFoundError)
    await expect(listGuides(db, g)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('reglas adicionales', () => {
  it('en un grupo archivado no se renombra, asigna, quita rutas ni alumnos', async () => {
    const { g, group } = await guideWithGroup()
    const a = await seedUser(db)
    await db.insert(memberships).values({ groupId: group.id, userId: a.id })
    await assignPath(db, g, group.id, 'curated:fundamentos', null, catalog)
    await archiveGroup(db, g, group.id)
    await expect(renameGroup(db, g, group.id, 'B')).rejects.toBeInstanceOf(NotFoundError)
    await expect(assignPath(db, g, group.id, 'generated:llm', null, catalog)).rejects.toBeInstanceOf(NotFoundError)
    await expect(unassignPath(db, g, group.id, 'curated:fundamentos')).rejects.toBeInstanceOf(NotFoundError)
    await expect(removeMember(db, g, group.id, a.id)).rejects.toBeInstanceOf(NotFoundError)
    expect(await getGroupForGuide(db, g, group.id)).toMatchObject({ name: 'Taller de IA' })
  })
  it('otro guía no puede quitar alumnos de un grupo ajeno', async () => {
    const { group } = await guideWithGroup()
    const a = await seedUser(db)
    await db.insert(memberships).values({ groupId: group.id, userId: a.id })
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(removeMember(db, other, group.id, a.id)).rejects.toBeInstanceOf(NotFoundError)
    expect(await db.select().from(memberships).where(eq(memberships.userId, a.id))).toHaveLength(1)
  })
  it('re-autorizar a un guía revocado lo vuelve guía', async () => {
    const admin = asActor(await seedUser(db), true)
    const u = await seedUser(db, { email: 'vuelve@guia.com' })
    await grantGuide(db, admin, 'vuelve@guia.com')
    await revokeGuide(db, admin, u.id)
    const [revoked] = await db.select().from(user).where(eq(user.id, u.id))
    expect(revoked.isGuide).toBe(false)
    await grantGuide(db, admin, 'vuelve@guia.com')
    const [again] = await db.select().from(user).where(eq(user.id, u.id))
    expect(again.isGuide).toBe(true)
  })
  it('una invitación con mayúsculas se reclama con el correo en minúsculas', async () => {
    const admin = asActor(await seedUser(db), true)
    await grantGuide(db, admin, 'Mixta@Caso.com')
    const u = await seedUser(db, { email: 'mixta@caso.com' })
    await claimGuideInvite(db, u)
    const [row] = await db.select().from(user).where(eq(user.id, u.id))
    expect(row.isGuide).toBe(true)
    expect(await hasGuideInvite(db, 'mixta@caso.com')).toBe(false)
  })
  it('revocar a un guía conserva las membresías de sus grupos', async () => {
    const admin = asActor(await seedUser(db), true)
    const { g, group } = await guideWithGroup()
    const a = await seedUser(db)
    await db.insert(memberships).values({ groupId: group.id, userId: a.id })
    await revokeGuide(db, admin, g.id)
    const rows = await db.select().from(memberships).where(eq(memberships.groupId, group.id))
    expect(rows.map((r) => r.userId)).toEqual([a.id])
  })
})
