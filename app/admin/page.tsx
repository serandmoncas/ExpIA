import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { listGuides } from '@/lib/groups'
import { grantGuideAction, revokeGuideAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Administrar' }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/admin')
  if (!actor.isAdmin) notFound()
  const { error } = await searchParams
  const { active, pending } = await listGuides(await getDb(), actor)
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Guías</h1>
      <form action={grantGuideAction} className="flex max-w-md items-end gap-2">
        <label className="flex flex-1 flex-col text-sm">Correo del guía<Input name="email" type="email" required /></label>
        <Button type="submit">Autorizar</Button>
      </form>
      {error === 'correo-invalido' && <p role="alert" className="text-destructive">Ese correo no es válido.</p>}
      <ul className="flex flex-col gap-1 text-sm">
        {active.map((g) => (
          <li key={g.id} className="flex items-center gap-2" data-testid="guide-row">
            <span>{g.name} · {g.email}</span>
            <form action={revokeGuideAction.bind(null, g.id)}><Button type="submit" variant="ghost" size="sm">Quitar rol</Button></form>
          </li>
        ))}
        {pending.map((email) => <li key={email} data-testid="guide-row" className="text-muted-foreground">{email} · todavía no entra</li>)}
      </ul>
    </div>
  )
}
