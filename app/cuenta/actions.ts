'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db/client'
import { getActor } from '@/lib/session'
import { leaveGroup } from '@/lib/groups'

export async function leaveGroupAction(groupId: string) {
  const actor = await getActor()
  if (!actor) redirect('/entrar?next=/cuenta')
  await leaveGroup(await getDb(), actor.id, groupId)
  revalidatePath('/cuenta')
}
