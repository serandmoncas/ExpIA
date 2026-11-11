import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { assignments, groups, guideInvites, memberships, user } from '@/lib/db/schema'
import type { Catalog } from '@/lib/content/types'
import {
  canManageGroup, canViewGroup, InputError, normalizeEmail, NotFoundError, requireAdmin, requireGuide, type Actor,
} from '@/lib/access'
import { resolvePathRef } from '@/lib/path-refs'

export type GroupRow = typeof groups.$inferSelect

const nameSchema = z.string().trim().min(1).max(80)
const dueSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()

// La forma YYYY-MM-DD no basta: 2026-02-30 pasaría la regex y Postgres fallaría
function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}
const emailSchema = z.string().email()

function parseName(name: string): string {
  const r = nameSchema.safeParse(name)
  if (!r.success) throw new InputError('nombre-invalido')
  return r.data
}

async function findGroup(db: Db, groupId: string): Promise<GroupRow | undefined> {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId))
  return g
}

export async function getGroupForGuide(db: Db, actor: Actor, groupId: string): Promise<GroupRow> {
  const g = await findGroup(db, groupId)
  if (!g || !canViewGroup(actor, g)) throw new NotFoundError()
  return g
}

export async function loadManagedGroup(db: Db, actor: Actor, groupId: string): Promise<GroupRow> {
  const g = await findGroup(db, groupId)
  if (!g || !canManageGroup(actor, g)) throw new NotFoundError()
  return g
}

export async function createGroup(db: Db, actor: Actor, name: string): Promise<GroupRow> {
  requireGuide(actor)
  const [g] = await db.insert(groups).values({ name: parseName(name), guideId: actor.id }).returning()
  return g
}

export async function listGuideGroups(db: Db, actor: Actor): Promise<(GroupRow & { members: number })[]> {
  requireGuide(actor)
  const rows = await db
    .select({ g: groups, members: count(memberships.userId) })
    .from(groups)
    .leftJoin(memberships, eq(memberships.groupId, groups.id))
    .where(eq(groups.guideId, actor.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.createdAt))
  return rows.map((r) => ({ ...r.g, members: Number(r.members) }))
}

export async function renameGroup(db: Db, actor: Actor, groupId: string, name: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(groups).set({ name: parseName(name) }).where(eq(groups.id, groupId))
}

export async function archiveGroup(db: Db, actor: Actor, groupId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId))
}

export async function listMembers(db: Db, actor: Actor, groupId: string) {
  await getGroupForGuide(db, actor, groupId)
  return db
    .select({ userId: user.id, name: user.name, email: user.email, joinedAt: memberships.joinedAt })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(user.name))
}

export async function removeMember(db: Db, actor: Actor, groupId: string, userId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
}

export async function leaveGroup(db: Db, userId: string, groupId: string): Promise<void> {
  await db.delete(memberships).where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
}

export async function assignPath(
  db: Db, actor: Actor, groupId: string, ref: string, dueDate: string | null, catalog: Catalog,
): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  if (!resolvePathRef(ref, catalog)) throw new InputError('ruta-inexistente')
  const due = dueSchema.safeParse(dueDate)
  if (!due.success || (due.data !== null && !isRealDate(due.data))) throw new InputError('fecha-invalida')
  await db
    .insert(assignments)
    .values({ groupId, pathRef: ref, dueDate: due.data })
    .onConflictDoUpdate({ target: [assignments.groupId, assignments.pathRef], set: { dueDate: due.data } })
}

export async function unassignPath(db: Db, actor: Actor, groupId: string, ref: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.delete(assignments).where(and(eq(assignments.groupId, groupId), eq(assignments.pathRef, ref)))
}

// Sin control de acceso: quien llama ya verificó que puede ver el grupo (getGroupForGuide o sus propios grupos)
export async function listAssignments(db: Db, groupId: string): Promise<{ pathRef: string; dueDate: string | null }[]> {
  return db
    .select({ pathRef: assignments.pathRef, dueDate: assignments.dueDate })
    .from(assignments)
    .where(eq(assignments.groupId, groupId))
    .orderBy(asc(assignments.createdAt), asc(assignments.pathRef))
}

export async function hasGuideInvite(db: Db, email: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(guideInvites)
    .where(and(eq(guideInvites.email, normalizeEmail(email)), isNull(guideInvites.usedAt)))
  return Boolean(row)
}

export async function claimGuideInvite(db: Db, u: { id: string; email: string }): Promise<void> {
  const email = normalizeEmail(u.email)
  if (!(await hasGuideInvite(db, email))) return
  await db.update(user).set({ isGuide: true }).where(eq(user.id, u.id))
  await db.update(guideInvites).set({ usedAt: new Date() }).where(eq(guideInvites.email, email))
}

export async function grantGuide(db: Db, actor: Actor, rawEmail: string): Promise<void> {
  requireAdmin(actor)
  const parsed = emailSchema.safeParse(normalizeEmail(rawEmail))
  if (!parsed.success) throw new InputError('correo-invalido')
  const email = parsed.data
  await db.insert(guideInvites).values({ email }).onConflictDoUpdate({ target: guideInvites.email, set: { usedAt: null } })
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
  if (existing) await claimGuideInvite(db, { id: existing.id, email })
}

export async function revokeGuide(db: Db, actor: Actor, userId: string): Promise<void> {
  requireAdmin(actor)
  const [u] = await db.update(user).set({ isGuide: false }).where(eq(user.id, userId)).returning({ email: user.email })
  if (!u) return
  await db.update(groups).set({ archivedAt: new Date() }).where(and(eq(groups.guideId, userId), isNull(groups.archivedAt)))
  await db.delete(guideInvites).where(eq(guideInvites.email, normalizeEmail(u.email)))
}

export async function listGuides(db: Db, actor: Actor) {
  requireAdmin(actor)
  const active = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.isGuide, true))
    .orderBy(asc(user.email))
  const pending = await db
    .select({ email: guideInvites.email })
    .from(guideInvites)
    .where(isNull(guideInvites.usedAt))
    .orderBy(asc(guideInvites.email))
  return { active, pending: pending.map((p) => p.email) }
}
