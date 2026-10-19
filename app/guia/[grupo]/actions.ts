'use server'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db/client'
import { getCatalog } from '@/lib/content/load'
import { getActor } from '@/lib/session'
import { getMailer } from '@/lib/email'
import { siteUrl } from '@/lib/site-url'
import { InputError, NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, assignPath, removeMember, renameGroup, unassignPath } from '@/lib/groups'
import { createLinkInvite, revokeInvite } from '@/lib/invites'
import { sendEmailInvites } from '@/lib/invite-mail'
import { curatedRef, generatedRef } from '@/lib/path-refs'

// Carga la sesión y traduce los errores del dominio: NotFound → 404, InputError → mensaje en la página
async function run(groupId: string, fn: (actor: Actor) => Promise<string | void>): Promise<never> {
  const actor = await getActor()
  if (!actor) redirect(`/entrar?next=/guia/${groupId}`)
  let query = ''
  try {
    query = (await fn(actor)) ?? ''
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    if (e instanceof InputError) redirect(`/guia/${groupId}?error=${e.code}`)
    throw e
  }
  revalidatePath(`/guia/${groupId}`)
  redirect(`/guia/${groupId}${query}`)
}

const numberOrNull = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v))

export async function createLinkAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const { token } = await createLinkInvite(await getDb(), actor, groupId, {
      days: numberOrNull(form.get('days')) ?? undefined,
      maxUses: numberOrNull(form.get('maxUses')),
    })
    // El enlace se muestra una sola vez: solo se guarda su hash
    return `?nuevo=${encodeURIComponent(`${siteUrl(await headers())}/unirse/${token}`)}`
  })
}

export async function emailInvitesAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const r = await sendEmailInvites(await getDb(), getMailer(), actor, groupId, String(form.get('emails') ?? ''), siteUrl(await headers()))
    return `?enviados=${r.sent}&omitidos=${r.skipped}`
  })
}

export async function revokeInviteAction(groupId: string, inviteId: string) {
  await run(groupId, async (actor) => { await revokeInvite(await getDb(), actor, groupId, inviteId) })
}

export async function assignAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => {
    const curated = String(form.get('curated') ?? '')
    const node = String(form.get('node') ?? '').trim()
    const ref = curated ? curatedRef(curated) : generatedRef(node)
    const due = String(form.get('dueDate') ?? '') || null
    await assignPath(await getDb(), actor, groupId, ref, due, getCatalog())
  })
}

export async function unassignAction(groupId: string, ref: string) {
  await run(groupId, async (actor) => { await unassignPath(await getDb(), actor, groupId, ref) })
}

export async function removeMemberAction(groupId: string, userId: string) {
  await run(groupId, async (actor) => { await removeMember(await getDb(), actor, groupId, userId) })
}

export async function renameAction(groupId: string, form: FormData) {
  await run(groupId, async (actor) => { await renameGroup(await getDb(), actor, groupId, String(form.get('name') ?? '')) })
}

export async function archiveAction(groupId: string) {
  await run(groupId, async (actor) => { await archiveGroup(await getDb(), actor, groupId) })
}
