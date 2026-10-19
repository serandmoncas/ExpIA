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

export async function registrationAllowed(
  db: Db, admins: ReadonlySet<string>, email: string, cookieHeader: string | null, now = new Date(),
): Promise<boolean> {
  const token = readCookie(cookieHeader, INVITE_COOKIE)
  let problem: ReturnType<typeof inviteProblem> | undefined
  if (token) {
    const found = await findInvite(db, token)
    problem = inviteProblem(found?.invite, Boolean(found?.group.archivedAt), email, now)
  }
  return mayRegister({ isAdmin: isAdmin(email, admins), hasGuideInvite: await hasGuideInvite(db, email), inviteProblem: problem })
}
