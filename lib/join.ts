import { NextResponse } from 'next/server'
import type { Db } from '@/lib/db/client'
import type { Actor, InviteProblem } from '@/lib/access'
import { INVITE_COOKIE, redeemInvite } from '@/lib/invites'

const INVALID = 'Este enlace ya no es válido. Pídele uno nuevo a tu guía.'

export const INVITE_MESSAGES: Record<InviteProblem, string> = {
  'not-found': INVALID,
  revoked: INVALID,
  archived: INVALID,
  expired: INVALID,
  exhausted: INVALID,
  'wrong-email': 'Esta invitación es para otro correo.',
}

// La cookie le permite al registro saber que esta persona viene invitada
export function joinStart(req: Request, token: string): Response {
  const next = `/unirse/${token}/canjear`
  const res = NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(next)}`, req.url))
  res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600, secure: req.url.startsWith('https:') })
  return res
}

export async function joinRedeem(req: Request, token: string, deps: { db: Db; actor: Actor | null; now?: Date }): Promise<Response> {
  if (!deps.actor) return NextResponse.redirect(new URL(`/unirse/${token}`, req.url))
  const r = await redeemInvite(deps.db, { token, userId: deps.actor.id, email: deps.actor.email }, deps.now)
  const res = NextResponse.redirect(new URL(r.ok ? `/cuenta?unido=${r.groupId}` : `/unirse/${token}?error=${r.reason}`, req.url))
  if (r.ok) res.cookies.set(INVITE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
