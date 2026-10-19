import { describe, expect, it } from 'vitest'
import {
  actorFromSession, canManageGroup, canViewGroup, inviteProblem, isAdmin, maskEmail, mayRegister,
  normalizeEmail, parseAdminEmails, requireAdmin, requireGuide, safeNext, NotFoundError, type Actor, type InviteState,
} from '@/lib/access'

const actor = (over: Partial<Actor> = {}): Actor => ({ id: 'g1', email: 'g@x.com', name: 'G', isGuide: true, isAdmin: false, ...over })
const now = new Date('2026-10-19T12:00:00Z')
const inv = (over: Partial<InviteState> = {}): InviteState => ({
  kind: 'link', email: null, expiresAt: new Date('2026-11-01T00:00:00Z'), maxUses: null, uses: 0, revokedAt: null, ...over,
})

describe('correos y administradores', () => {
  it('normaliza correos a minúsculas y sin espacios', () => {
    expect(normalizeEmail('  Ana@Gmail.COM ')).toBe('ana@gmail.com')
  })
  it('lee ADMIN_EMAILS separados por coma, sin importar mayúsculas', () => {
    const admins = parseAdminEmails(' Yo@X.com, otra@y.com ,, ')
    expect([...admins]).toEqual(['yo@x.com', 'otra@y.com'])
    expect(isAdmin('YO@x.com', admins)).toBe(true)
    expect(isAdmin('nadie@x.com', admins)).toBe(false)
    expect(parseAdminEmails(undefined).size).toBe(0)
  })
  it('arma el Actor desde la sesión', () => {
    const a = actorFromSession({ id: 'u', email: 'Yo@X.com', name: 'Yo', isGuide: true }, parseAdminEmails('yo@x.com'))
    expect(a).toEqual({ id: 'u', email: 'yo@x.com', name: 'Yo', isGuide: true, isAdmin: true })
    expect(actorFromSession({ id: 'u', email: 'a@b.c', name: 'A' }, new Set()).isGuide).toBe(false)
  })
  it('enmascara un correo', () => {
    expect(maskEmail('ana@gmail.com')).toBe('a***@gmail.com')
  })
})

describe('permisos sobre grupos', () => {
  const own = { guideId: 'g1', archivedAt: null }
  it('el guía dueño puede ver y administrar su grupo', () => {
    expect(canViewGroup(actor(), own)).toBe(true)
    expect(canManageGroup(actor(), own)).toBe(true)
  })
  it('otro guía no puede ver ni administrar', () => {
    expect(canViewGroup(actor({ id: 'g2' }), own)).toBe(false)
    expect(canManageGroup(actor({ id: 'g2' }), own)).toBe(false)
  })
  it('quien dejó de ser guía no ve sus grupos; el administrador tampoco ve grupos ajenos', () => {
    expect(canViewGroup(actor({ isGuide: false }), own)).toBe(false)
    expect(canViewGroup(actor({ id: 'adm', isAdmin: true }), own)).toBe(false)
  })
  it('un grupo archivado se ve pero no se administra', () => {
    const archived = { guideId: 'g1', archivedAt: now }
    expect(canViewGroup(actor(), archived)).toBe(true)
    expect(canManageGroup(actor(), archived)).toBe(false)
  })
  it('requireGuide y requireAdmin lanzan NotFoundError', () => {
    expect(() => requireGuide(actor({ isGuide: false }))).toThrow(NotFoundError)
    expect(() => requireAdmin(actor())).toThrow(NotFoundError)
    expect(() => requireAdmin(actor({ isAdmin: true }))).not.toThrow()
  })
})

describe('estado de una invitación', () => {
  it('una invitación vigente no tiene problemas', () => {
    expect(inviteProblem(inv(), false, null, now)).toBeNull()
  })
  it.each([
    ['not-found', undefined, false],
    ['revoked', inv({ revokedAt: now }), false],
    ['archived', inv(), true],
    ['expired', inv({ expiresAt: new Date('2026-10-19T11:59:59Z') }), false],
    ['exhausted', inv({ maxUses: 3, uses: 3 }), false],
  ] as const)('detecta %s', (problem, i, archived) => {
    expect(inviteProblem(i, archived, null, now)).toBe(problem)
  })
  it('una invitación por correo exige el mismo correo, sin importar mayúsculas', () => {
    const byEmail = inv({ kind: 'email', email: 'ana@gmail.com', maxUses: 1 })
    expect(inviteProblem(byEmail, false, 'Ana@Gmail.com', now)).toBeNull()
    expect(inviteProblem(byEmail, false, 'otra@gmail.com', now)).toBe('wrong-email')
    expect(inviteProblem(byEmail, false, null, now)).toBeNull()
  })
})

describe('registro', () => {
  it('solo con administrador, invitación de guía o invitación válida', () => {
    expect(mayRegister({ isAdmin: true, hasGuideInvite: false, inviteProblem: undefined })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: true, inviteProblem: undefined })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: null })).toBe(true)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: 'expired' })).toBe(false)
    expect(mayRegister({ isAdmin: false, hasGuideInvite: false, inviteProblem: undefined })).toBe(false)
  })
})

describe('safeNext', () => {
  it('acepta rutas internas', () => {
    expect(safeNext('/guia/abc?x=1')).toBe('/guia/abc?x=1')
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined])('rechaza %s', (n) => {
    expect(safeNext(n)).toBe('/cuenta')
  })
})
