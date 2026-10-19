import { notFound, redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { NotFoundError } from '@/lib/access'
import { getGroupForGuide, listMembers } from '@/lib/groups'
import { listInvites, DEFAULT_DAYS, MAX_DAYS } from '@/lib/invites'
import { groupProgress } from '@/lib/progress'
import { messageFor } from '@/lib/messages'
import {
  archiveAction, assignAction, createLinkAction, emailInvitesAction, removeMemberAction, renameAction, revokeInviteAction, unassignAction,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Grupo' }

const ERROR_MESSAGES: Record<string, string> = {
  'nombre-invalido': 'El nombre debe tener entre 1 y 80 caracteres.',
  'ruta-inexistente': 'Esa ruta no existe. Elige una ruta curada o escribe el id de un nodo del catálogo.',
  'fecha-invalida': 'La fecha no es válida.',
  'dias-invalidos': `El vencimiento debe ser de 1 a ${MAX_DAYS} días.`,
  'usos-invalidos': 'El máximo de usos debe ser 1 o más, o quedar vacío.',
  'cantidad-de-correos': 'Pega entre 1 y 50 correos.',
  'correo-invalido': 'Hay un correo mal escrito.',
}

const fmt = (d: Date) => d.toISOString().slice(0, 10)

export default async function GrupoPage({
  params, searchParams,
}: {
  params: Promise<{ grupo: string }>
  searchParams: Promise<{ error?: string; nuevo?: string; enviados?: string; omitidos?: string }>
}) {
  const { grupo } = await params
  const q = await searchParams
  const actor = await getActor()
  if (!actor) redirect(`/entrar?next=/guia/${grupo}`)
  const db = await getDb()
  const catalog = getCatalog()
  let group
  try {
    group = await getGroupForGuide(db, actor, grupo)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const [table, members, invites] = await Promise.all([
    groupProgress(db, actor, grupo, catalog), listMembers(db, actor, grupo), listInvites(db, actor, grupo),
  ])
  const editable = !group.archivedAt
  const now = Date.now()
  const live = invites.filter((i) => !i.revokedAt && i.expiresAt.getTime() > now && (i.maxUses === null || i.uses < i.maxUses))

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {!editable && <p className="text-muted-foreground">Grupo archivado: se puede consultar, pero no modificar.</p>}
        {q.error && <p role="alert" className="text-destructive">{messageFor(ERROR_MESSAGES, q.error, 'No se pudo completar la acción.')}</p>}
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Avance</h2>
        {table.rows.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay alumnos en el grupo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="progress-table" className="text-sm">
              <thead>
                <tr>
                  <th className="pr-6 text-left">Alumno</th>
                  {table.columns.map((c) => (
                    <th key={c.ref} className="pr-6 text-left">{c.title ?? 'Ruta no disponible'}{c.dueDate && <span className="block font-normal text-muted-foreground">para el {c.dueDate}</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.userId} data-testid="progress-row">
                    <td className="pr-6">{r.name}</td>
                    {r.cells.map((cell, i) => (
                      <td key={table.columns[i].ref} className="pr-6">
                        {cell ? (cell.done === cell.total ? 'Completada' : `${cell.done} de ${cell.total}`) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Rutas asignadas</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {table.columns.map((c) => (
            <li key={c.ref} className="flex items-center gap-2">
              <span>{c.title ?? 'Ruta no disponible'}</span>
              {editable && (
                <form action={unassignAction.bind(null, group.id, c.ref)}><Button type="submit" variant="ghost" size="sm">Quitar</Button></form>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form action={assignAction.bind(null, group.id)} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">Ruta curada
              <select name="curated" className="h-9 rounded-md border px-2">
                <option value="">— o usa un nodo —</option>
                {catalog.paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-sm">Nodo (ruta generada)
              <Input name="node" list="nodes" placeholder="p. ej. llm" />
              <datalist id="nodes">{catalog.nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</datalist>
            </label>
            <label className="flex flex-col text-sm">Fecha (opcional)<Input type="date" name="dueDate" /></label>
            <Button type="submit">Asignar</Button>
          </form>
        )}
      </section>

      {editable && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Invitar</h2>
          {q.nuevo && (
            <p className="rounded-md border p-3 text-sm">
              Copia este enlace ahora; no se volverá a mostrar:{' '}
              <code data-testid="new-invite" className="break-all">{q.nuevo}</code>
            </p>
          )}
          {q.enviados && <p className="text-sm">Se enviaron {q.enviados} invitaciones{Number(q.omitidos) > 0 && <>; {q.omitidos} quedaron sin enviar por el límite diario</>}.</p>}
          <form action={createLinkAction.bind(null, group.id)} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-sm">Vence en (días)<Input type="number" name="days" min={1} max={MAX_DAYS} defaultValue={DEFAULT_DAYS} /></label>
            <label className="flex flex-col text-sm">Máximo de usos<Input type="number" name="maxUses" min={1} placeholder="Sin límite" /></label>
            <Button type="submit">Crear enlace</Button>
          </form>
          <form action={emailInvitesAction.bind(null, group.id)} className="flex flex-col gap-2">
            <label htmlFor="emails" className="text-sm">O pega hasta 50 correos</label>
            <textarea id="emails" name="emails" rows={3} className="rounded-md border p-2 text-sm" />
            <Button type="submit" variant="outline" className="self-start">Enviar invitaciones</Button>
          </form>
          <ul className="flex flex-col gap-1 text-sm">
            {live.map((i) => (
              <li key={i.id} className="flex items-center gap-2" data-testid="live-invite">
                <span>{i.kind === 'email' ? i.email : 'Enlace'} · vence el {fmt(i.expiresAt)} · {i.uses}{i.maxUses !== null && ` de ${i.maxUses}`} usos</span>
                <form action={revokeInviteAction.bind(null, group.id, i.id)}><Button type="submit" variant="ghost" size="sm">Revocar</Button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Alumnos</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2">
              <span>{m.name} · {m.email}</span>
              {editable && <form action={removeMemberAction.bind(null, group.id, m.userId)}><Button type="submit" variant="ghost" size="sm">Quitar</Button></form>}
            </li>
          ))}
        </ul>
      </section>

      {editable && (
        <section className="flex flex-wrap items-end gap-4">
          <form action={renameAction.bind(null, group.id)} className="flex items-end gap-2">
            <label className="flex flex-col text-sm">Nombre del grupo<Input name="name" defaultValue={group.name} maxLength={80} /></label>
            <Button type="submit" variant="outline">Renombrar</Button>
          </form>
          <form action={archiveAction.bind(null, group.id)}><Button type="submit" variant="destructive">Archivar grupo</Button></form>
        </section>
      )}
    </div>
  )
}
