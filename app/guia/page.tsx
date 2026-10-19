import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { listGuideGroups } from '@/lib/groups'
import { createGroupAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tus grupos' }

export default async function GuiaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/guia')
  if (!actor.isGuide) notFound()
  const { error } = await searchParams
  const groups = await listGuideGroups(await getDb(), actor)
  const active = groups.filter((g) => !g.archivedAt)
  const archived = groups.filter((g) => g.archivedAt)
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Tus grupos</h1>
      <form action={createGroupAction} className="flex max-w-md gap-2">
        <label htmlFor="name" className="sr-only">Nombre del grupo</label>
        <Input id="name" name="name" placeholder="Nombre del grupo" maxLength={80} required />
        <Button type="submit">Crear grupo</Button>
      </form>
      {error === 'nombre-invalido' && <p role="alert" className="text-destructive">El nombre debe tener entre 1 y 80 caracteres.</p>}
      <ul className="flex flex-col gap-2">
        {active.map((g) => (
          <li key={g.id}><Link href={`/guia/${g.id}`} className="underline">{g.name}</Link> · {g.members} {g.members === 1 ? 'alumno' : 'alumnos'}</li>
        ))}
        {active.length === 0 && <li className="text-muted-foreground">Todavía no tienes grupos.</li>}
      </ul>
      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Archivados</h2>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {archived.map((g) => <li key={g.id}><Link href={`/guia/${g.id}`} className="underline">{g.name}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
