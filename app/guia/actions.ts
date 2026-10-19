'use server'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { createGroup } from '@/lib/groups'
import { InputError, NotFoundError } from '@/lib/access'

export async function createGroupAction(form: FormData) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/guia')
  let id: string
  try {
    id = (await createGroup(await getDb(), actor, String(form.get('name') ?? ''))).id
  } catch (e) {
    if (e instanceof InputError) redirect(`/guia?error=${e.code}`)
    if (e instanceof NotFoundError) redirect('/cuenta')
    throw e
  }
  redirect(`/guia/${id}`)
}
