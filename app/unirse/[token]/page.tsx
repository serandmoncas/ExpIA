import Link from 'next/link'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { findInvite } from '@/lib/invites'
import { inviteProblem, maskEmail } from '@/lib/access'
import { INVITE_MESSAGES, parseInviteProblem } from '@/lib/join'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invitación' }

export default async function UnirsePage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params
  const { error } = await searchParams
  const db = await getDb()
  const found = await findInvite(db, token)
  const actor = await getActor()
  const problem = parseInviteProblem(error) ?? inviteProblem(found?.invite, Boolean(found?.group.archivedAt), actor?.email ?? null, new Date())

  if (!found || problem) {
    const msg = problem === 'wrong-email' && found?.invite.email
      ? `Esta invitación es para ${maskEmail(found.invite.email)}. Entra con ese correo.`
      : INVITE_MESSAGES[problem ?? 'not-found'] ?? INVITE_MESSAGES['not-found']
    return <p role="alert" data-testid="invite-invalid">{msg}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Te invitaron a «{found.group.name}»</h1>
      <p className="text-muted-foreground">Guía: {found.guideName}</p>
      {actor ? (
        <Link className={buttonVariants()} href={`/unirse/${token}/canjear`}>Unirme al grupo</Link>
      ) : (
        <Link className={buttonVariants()} href={`/unirse/${token}/entrar`}>Entrar para unirme</Link>
      )}
    </div>
  )
}
