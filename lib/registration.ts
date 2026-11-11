import type { Db } from '@/lib/db/client'
import { inviteProblem, isAdmin, mayRegister } from '@/lib/access'
import { hasGuideInvite } from '@/lib/groups'
import { findInvite, INVITE_COOKIE } from '@/lib/invites'

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

const CALLBACK_RE = /^\/unirse\/([A-Za-z0-9_-]+)\/canjear$/

// El enlace mágico vuelve a /unirse/<token>/canjear: así la invitación viaja con el enlace
// y funciona aunque se abra en otro navegador, donde no está la cookie
export function tokenFromCallback(callbackURL: string | null | undefined): string | null {
  if (!callbackURL) return null
  let path = callbackURL
  if (!path.startsWith('/')) {
    try { path = new URL(path).pathname } catch { return null }
  }
  return CALLBACK_RE.exec(path)?.[1] ?? null
}

export async function registrationAllowed(
  db: Db, admins: ReadonlySet<string>, email: string,
  source: { cookieHeader: string | null; callbackURL?: string | null }, now = new Date(),
): Promise<boolean> {
  const token = readCookie(source.cookieHeader, INVITE_COOKIE) ?? tokenFromCallback(source.callbackURL)
  let problem: ReturnType<typeof inviteProblem> | undefined
  if (token) {
    const found = await findInvite(db, token)
    problem = inviteProblem(found?.invite, Boolean(found?.group.archivedAt), email, now)
  }
  return mayRegister({ isAdmin: isAdmin(email, admins), hasGuideInvite: await hasGuideInvite(db, email), inviteProblem: problem })
}
