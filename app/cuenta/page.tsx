import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { studentGroups } from '@/lib/progress'
import { leaveGroupAction } from './actions'
import { SignOutButton } from '@/components/sign-out-button'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tu cuenta' }

export default async function CuentaPage() {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/cuenta')
  const mine = await studentGroups(await getDb(), actor.id, getCatalog())
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Hola, {actor.name}</h1>
        <div className="flex gap-3">
          {actor.isGuide && <Link href="/guia" className="text-sm underline">Tus grupos como guía</Link>}
          {actor.isAdmin && <Link href="/admin" className="text-sm underline">Administrar</Link>}
          <SignOutButton />
        </div>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Tus grupos</h2>
        {mine.length === 0 && <p className="text-muted-foreground">Todavía no estás en ningún grupo.</p>}
        <ul className="flex flex-col gap-6">
          {mine.map((g) => (
            <li key={g.groupId} data-testid="student-group" className="rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{g.name} <span className="text-sm text-muted-foreground">· {g.guideName}</span></p>
                <form action={leaveGroupAction.bind(null, g.groupId)}>
                  <Button type="submit" variant="ghost" size="sm">Salir del grupo</Button>
                </form>
              </div>
              {g.paths.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Tu guía todavía no asignó rutas.</p>}
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {g.paths.map((p) => (
                  <li key={p.ref}>
                    {p.href ? <Link href={p.href} className="underline">{p.title}</Link> : <span>Ruta no disponible</span>}
                    {' '}— {p.done} de {p.total}{p.dueDate && <> · para el {p.dueDate}</>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
