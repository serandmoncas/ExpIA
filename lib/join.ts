import { NextResponse } from 'next/server'
import type { Db } from '@/lib/db/client'
import type { Actor, InviteProblem } from '@/lib/access'
import { INVITE_COOKIE, redeemInvite } from '@/lib/invites'
import { readCookie } from '@/lib/registration'

const INVALID = 'Este enlace ya no es válido. Pídele uno nuevo a tu guía.'

export const INVITE_MESSAGES: Record<InviteProblem, string> = {
  'not-found': INVALID,
  revoked: INVALID,
  archived: INVALID,
  expired: INVALID,
  exhausted: INVALID,
  'wrong-email': 'Esta invitación es para otro correo.',
}

// Los POST que cambian estado solo valen si los envió una página de este sitio.
// Las cookies de sesión son SameSite=Lax y viajan en navegaciones entre sitios,
// pero un POST entre sitios no debe poder actuar en nombre de la persona.
export function isSameOriginPost(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site !== null) return site === 'same-origin'
  const origin = req.headers.get('origin')
  if (origin !== null) return origin === new URL(req.url).origin
  // Sin ninguna de las dos cabeceras no es un navegador moderno: un cliente así
  // no puede usar las cookies de otra persona, así que no hay CSRF que frenar.
  return true
}

const forbidden = () => new NextResponse('Solicitud no permitida.', { status: 403 })

// Solo por POST desde este sitio: un GET no puede dejar la cookie de invitación.
// La cookie le permite al registro saber que esta persona viene invitada
export function joinStart(req: Request, token: string): Response {
  if (req.method !== 'POST') return NextResponse.redirect(new URL(`/unirse/${token}`, req.url))
  if (!isSameOriginPost(req)) return forbidden()
  const next = `/unirse/${token}/canjear`
  const res = NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(next)}`, req.url), 303)
  res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600, secure: req.url.startsWith('https:') })
  return res
}

export async function joinRedeem(req: Request, token: string, deps: { db: Db; actor: Actor | null; now?: Date }): Promise<Response> {
  const isPost = req.method === 'POST'
  if (isPost && !isSameOriginPost(req)) return forbidden()
  // Tras un POST se responde 303: el navegador sigue con GET y no reenvía el formulario
  const status = isPost ? 303 : 307
  // Un GET solo canjea al volver de iniciar sesión en este mismo navegador (la cookie la dejó
  // /entrar). Si no, un enlace ajeno podría unir a alguien sin que lo confirme: se le pide el clic.
  const confirmed = isPost || readCookie(req.headers.get('cookie'), INVITE_COOKIE) === token
  if (!deps.actor || !confirmed) return NextResponse.redirect(new URL(`/unirse/${token}`, req.url), status)
  const r = await redeemInvite(deps.db, { token, userId: deps.actor.id, email: deps.actor.email }, deps.now)
  const res = NextResponse.redirect(new URL(r.ok ? `/cuenta?unido=${r.groupId}` : `/unirse/${token}?error=${r.reason}`, req.url), status)
  if (r.ok) res.cookies.set(INVITE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}

// El ?error de la URL lo controla cualquiera: solo se acepta un motivo conocido
export function parseInviteProblem(value: string | undefined): InviteProblem | null {
  return value !== undefined && Object.hasOwn(INVITE_MESSAGES, value) ? (value as InviteProblem) : null
}
