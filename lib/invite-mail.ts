import type { Db } from '@/lib/db/client'
import type { Actor } from '@/lib/access'
import { createEmailInvites } from '@/lib/invites'
import { loadManagedGroup } from '@/lib/groups'
import { inviteMail, sendLimited, type Mailer } from '@/lib/email'

export async function sendEmailInvites(
  db: Db, mailer: Mailer, actor: Actor, groupId: string, rawEmails: string, origin: string, now = new Date(),
): Promise<{ sent: number; skipped: number }> {
  const group = await loadManagedGroup(db, actor, groupId)
  const created = await createEmailInvites(db, actor, groupId, rawEmails, now)
  let sent = 0
  for (const { email, token } of created) {
    const ok = await sendLimited(
      db, mailer, { kind: 'invite', to: email, actorId: actor.id },
      inviteMail({ groupName: group.name, guideName: actor.name, url: `${origin}/unirse/${token}` }), now,
    )
    if (ok) sent++
  }
  return { sent, skipped: created.length - sent }
}
