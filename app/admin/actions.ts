'use server'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { grantGuide, revokeGuide } from '@/lib/groups'
import { InputError, NotFoundError } from '@/lib/access'

async function asAdmin(fn: (actor: NonNullable<Awaited<ReturnType<typeof getActor>>>) => Promise<void>) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/admin')
  try {
    await fn(actor)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    if (e instanceof InputError) redirect(`/admin?error=${e.code}`)
    throw e
  }
  revalidatePath('/admin')
  redirect('/admin')
}

export async function grantGuideAction(form: FormData) {
  await asAdmin(async (actor) => grantGuide(await getDb(), actor, String(form.get('email') ?? '')))
}

export async function revokeGuideAction(userId: string) {
  await asAdmin(async (actor) => revokeGuide(await getDb(), actor, userId))
}
