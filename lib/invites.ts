import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { groups, invites, memberships, user } from '@/lib/db/schema'
import { InputError, inviteProblem, normalizeEmail, type Actor, type InviteProblem } from '@/lib/access'
import { getGroupForGuide, loadManagedGroup } from '@/lib/groups'

export const INVITE_COOKIE = 'expia_invite'
export const DEFAULT_DAYS = 14
export const MAX_DAYS = 90
export const MAX_EMAILS = 50
const DAY = 24 * 60 * 60 * 1000

export const newToken = (): string => randomBytes(32).toString('base64url')
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

const daysSchema = z.number().int().min(1).max(MAX_DAYS)
const maxUsesSchema = z.number().int().min(1).nullable()
const emailSchema = z.string().email()

export async function createLinkInvite(
  db: Db, actor: Actor, groupId: string, opts: { days?: number; maxUses?: number | null }, now = new Date(),
): Promise<{ token: string; id: string }> {
  await loadManagedGroup(db, actor, groupId)
  const days = daysSchema.safeParse(opts.days ?? DEFAULT_DAYS)
  const maxUses = maxUsesSchema.safeParse(opts.maxUses ?? null)
  if (!days.success) throw new InputError('dias-invalidos')
  if (!maxUses.success) throw new InputError('usos-invalidos')
  const token = newToken()
  const [row] = await db
    .insert(invites)
    .values({
      groupId, kind: 'link', tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + days.data * DAY),
      maxUses: maxUses.data, createdBy: actor.id,
    })
    .returning({ id: invites.id })
  return { token, id: row.id }
}

// Acepta correos separados por comas, punto y coma, espacios o saltos de línea
export async function createEmailInvites(
  db: Db, actor: Actor, groupId: string, rawEmails: string, now = new Date(),
): Promise<{ email: string; token: string }[]> {
  await loadManagedGroup(db, actor, groupId)
  const emails = [...new Set(rawEmails.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean))]
  if (emails.length === 0 || emails.length > MAX_EMAILS) throw new InputError('cantidad-de-correos')
  if (emails.some((e) => !emailSchema.safeParse(e).success)) throw new InputError('correo-invalido')
  const out = emails.map((email) => ({ email, token: newToken() }))
  await db.insert(invites).values(
    out.map(({ email, token }) => ({
      groupId, kind: 'email' as const, tokenHash: hashToken(token), email,
      expiresAt: new Date(now.getTime() + DEFAULT_DAYS * DAY), maxUses: 1, createdBy: actor.id,
    })),
  )
  return out
}

export type InviteListItem = {
  id: string; kind: 'link' | 'email'; email: string | null; expiresAt: Date; maxUses: number | null; uses: number; revokedAt: Date | null
}

export async function listInvites(db: Db, actor: Actor, groupId: string): Promise<InviteListItem[]> {
  await getGroupForGuide(db, actor, groupId)
  return db
    .select({
      id: invites.id, kind: invites.kind, email: invites.email, expiresAt: invites.expiresAt,
      maxUses: invites.maxUses, uses: invites.uses, revokedAt: invites.revokedAt,
    })
    .from(invites)
    .where(eq(invites.groupId, groupId))
    .orderBy(desc(invites.createdAt), invites.email)
}

export async function revokeInvite(db: Db, actor: Actor, groupId: string, inviteId: string): Promise<void> {
  await loadManagedGroup(db, actor, groupId)
  await db.update(invites).set({ revokedAt: new Date() }).where(and(eq(invites.id, inviteId), eq(invites.groupId, groupId)))
}

export type FoundInvite = {
  invite: typeof invites.$inferSelect
  group: { id: string; name: string; archivedAt: Date | null }
  guideName: string
}

export async function findInvite(db: Db, token: string): Promise<FoundInvite | undefined> {
  const [row] = await db
    .select({ invite: invites, group: { id: groups.id, name: groups.name, archivedAt: groups.archivedAt }, guideName: user.name })
    .from(invites)
    .innerJoin(groups, eq(groups.id, invites.groupId))
    .innerJoin(user, eq(user.id, groups.guideId))
    .where(eq(invites.tokenHash, hashToken(token)))
  return row
}

async function isMember(db: Db, groupId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
  return Boolean(row)
}

export type RedeemResult ={ ok: true; groupId: string } | { ok: false; reason: InviteProblem }

export async function redeemInvite(
  db: Db, input: { token: string; userId: string; email: string }, now = new Date(),
): Promise<RedeemResult> {
  const found = await findInvite(db, input.token)
  if (!found) return { ok: false, reason: 'not-found' }
  const { invite } = found
  const problem = inviteProblem(invite, Boolean(found.group.archivedAt), input.email, now)
  // Quien ya es miembro entra aunque los usos se hayan agotado: no gasta otro uso
  if (problem && !(problem === 'exhausted' && (await isMember(db, invite.groupId, input.userId)))) {
    return { ok: false, reason: problem }
  }

  try {
    await db.transaction(async (tx) => {
      // La clave primaria de memberships decide: dos canjes simultáneos del mismo alumno no gastan dos usos
      const added = await tx
        .insert(memberships)
        .values({ groupId: invite.groupId, userId: input.userId })
        .onConflictDoNothing()
        .returning({ userId: memberships.userId })
      if (added.length === 0) return // ya era miembro: no se descuenta nada

      // Validar y descontar en una sola sentencia: dos alumnos distintos no pasan los dos
      const taken = await tx
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(
          and(
            eq(invites.id, invite.id), isNull(invites.revokedAt), gt(invites.expiresAt, now),
            or(isNull(invites.maxUses), lt(invites.uses, invites.maxUses)),
          ),
        )
        .returning({ id: invites.id })
      // Lanzar revierte también la inserción de membresía
      if (taken.length === 0) throw new ExhaustedSignal()
    })
    return { ok: true, groupId: invite.groupId }
  } catch (e) {
    if (e instanceof ExhaustedSignal) return { ok: false, reason: 'exhausted' }
    throw e
  }
}

class ExhaustedSignal extends Error {}
