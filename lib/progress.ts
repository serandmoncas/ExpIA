import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, learned, memberships, user } from '@/lib/db/schema'
import type { Catalog } from '@/lib/content/types'
import type { Actor } from '@/lib/access'
import { getGroupForGuide, listAssignments } from '@/lib/groups'
import { resolvePathRef } from '@/lib/path-refs'
import { pathProgress } from '@/lib/paths'

export const MAX_IMPORT = 500

export async function getLearned(db: Db, userId: string): Promise<string[]> {
  const rows = await db.select({ nodeId: learned.nodeId }).from(learned).where(eq(learned.userId, userId)).orderBy(asc(learned.learnedAt))
  return rows.map((r) => r.nodeId)
}

export async function setLearned(db: Db, userId: string, nodeId: string, on: boolean): Promise<void> {
  if (on) await db.insert(learned).values({ userId, nodeId }).onConflictDoNothing()
  else await db.delete(learned).where(and(eq(learned.userId, userId), eq(learned.nodeId, nodeId)))
}

export async function importLearned(db: Db, userId: string, ids: readonly string[]): Promise<string[]> {
  const unique = [...new Set(ids)]
  if (unique.length) await db.insert(learned).values(unique.map((nodeId) => ({ userId, nodeId }))).onConflictDoNothing()
  return getLearned(db, userId)
}

export type ProgressColumn = { ref: string; title: string | null; total: number; dueDate: string | null }
export type ProgressTable = {
  columns: ProgressColumn[]
  rows: { userId: string; name: string; email: string; cells: ({ done: number; total: number } | null)[] }[]
}

// Solo se leen los nodos de las rutas asignadas: el guía nunca recibe el resto de lo que marcó el alumno
async function learnedByUser(db: Db, userIds: string[], nodeIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map(userIds.map((id) => [id, new Set<string>()]))
  if (!userIds.length || !nodeIds.length) return out
  const rows = await db
    .select({ userId: learned.userId, nodeId: learned.nodeId })
    .from(learned)
    .where(and(inArray(learned.userId, userIds), inArray(learned.nodeId, nodeIds)))
  for (const r of rows) out.get(r.userId)!.add(r.nodeId)
  return out
}

export async function groupProgress(db: Db, actor: Actor, groupId: string, catalog: Catalog): Promise<ProgressTable> {
  await getGroupForGuide(db, actor, groupId)
  const assigned = await listAssignments(db, groupId)
  const resolved = assigned.map((a) => ({ a, path: resolvePathRef(a.pathRef, catalog) }))
  const members = await db
    .select({ userId: user.id, name: user.name, email: user.email })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.groupId, groupId))
    .orderBy(asc(user.name))
  const nodeIds = [...new Set(resolved.flatMap((r) => r.path?.ids ?? []))]
  const byUser = await learnedByUser(db, members.map((m) => m.userId), nodeIds)
  return {
    columns: resolved.map(({ a, path }) => ({ ref: a.pathRef, title: path?.title ?? null, total: path?.ids.length ?? 0, dueDate: a.dueDate })),
    rows: members.map((m) => ({
      ...m,
      cells: resolved.map(({ path }) => (path ? pathProgress(path.ids, byUser.get(m.userId)!) : null)),
    })),
  }
}

export type StudentGroup = {
  groupId: string
  name: string
  guideName: string
  paths: { ref: string; title: string | null; href: string | null; dueDate: string | null; done: number; total: number }[]
}

export async function studentGroups(db: Db, userId: string, catalog: Catalog): Promise<StudentGroup[]> {
  const rows = await db
    .select({ groupId: groups.id, name: groups.name, guideName: user.name })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .innerJoin(user, eq(user.id, groups.guideId))
    .where(and(eq(memberships.userId, userId), isNull(groups.archivedAt)))
    .orderBy(asc(groups.name))
  const mine = new Set(await getLearned(db, userId))
  const out: StudentGroup[] = []
  for (const r of rows) {
    const assigned = await listAssignments(db, r.groupId)
    out.push({
      ...r,
      paths: assigned.map((a) => {
        const path = resolvePathRef(a.pathRef, catalog)
        const p = path ? pathProgress(path.ids, mine) : { done: 0, total: 0 }
        return { ref: a.pathRef, title: path?.title ?? null, href: path?.href ?? null, dueDate: a.dueDate, ...p }
      }),
    })
  }
  return out
}
