export type Actor = { id: string; email: string; name: string; isGuide: boolean; isAdmin: boolean }

// 404 a propósito: no revelar si un grupo ajeno existe
export class NotFoundError extends Error {
  constructor() {
    super('No encontrado')
    this.name = 'NotFoundError'
  }
}

export class InputError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'InputError'
  }
}

export const normalizeEmail = (s: string): string => s.trim().toLowerCase()

export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map(normalizeEmail).filter(Boolean))
}

export const isAdmin = (email: string, admins: ReadonlySet<string>): boolean => admins.has(normalizeEmail(email))

export function actorFromSession(
  u: { id: string; email: string; name: string; isGuide?: unknown },
  admins: ReadonlySet<string>,
): Actor {
  const email = normalizeEmail(u.email)
  return { id: u.id, email, name: u.name, isGuide: u.isGuide === true, isAdmin: isAdmin(email, admins) }
}

export const canViewGroup = (actor: Actor, g: { guideId: string }): boolean => actor.isGuide && g.guideId === actor.id

export const canManageGroup = (actor: Actor, g: { guideId: string; archivedAt: Date | null }): boolean =>
  canViewGroup(actor, g) && g.archivedAt === null

export function requireGuide(actor: Actor): void {
  if (!actor.isGuide) throw new NotFoundError()
}

export function requireAdmin(actor: Actor): void {
  if (!actor.isAdmin) throw new NotFoundError()
}

export type InviteProblem = 'not-found' | 'revoked' | 'archived' | 'expired' | 'exhausted' | 'wrong-email'

export type InviteState = {
  kind: 'link' | 'email'
  email: string | null
  expiresAt: Date
  maxUses: number | null
  uses: number
  revokedAt: Date | null
}

// `email` es el de la sesión; null cuando todavía no se sabe (antes de iniciar sesión)
export function inviteProblem(
  inv: InviteState | undefined,
  groupArchived: boolean,
  email: string | null,
  now: Date,
): InviteProblem | null {
  if (!inv) return 'not-found'
  if (inv.revokedAt) return 'revoked'
  if (groupArchived) return 'archived'
  if (inv.expiresAt.getTime() <= now.getTime()) return 'expired'
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return 'exhausted'
  if (inv.kind === 'email' && email !== null && normalizeEmail(email) !== inv.email) return 'wrong-email'
  return null
}

// inviteProblem: undefined si no hay invitación, null si hay una válida
export const mayRegister = (i: { isAdmin: boolean; hasGuideInvite: boolean; inviteProblem: InviteProblem | null | undefined }): boolean =>
  i.isAdmin || i.hasGuideInvite || i.inviteProblem === null

// Solo rutas internas: evita redirigir a otro sitio después de iniciar sesión
export function safeNext(next: string | null | undefined, fallback = '/cuenta'): string {
  // Los navegadores quitan tab/CR/LF al interpretar URLs: "/\t/evil.com" se vuelve "//evil.com"
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\u0000-\u0020\u007f\\]/.test(next)) return fallback
  return next
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}
