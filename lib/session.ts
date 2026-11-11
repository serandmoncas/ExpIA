import { headers } from 'next/headers'
import { actorFromSession, parseAdminEmails, type Actor } from '@/lib/access'
import { getAuth } from '@/lib/auth'
import { accountsConfigured } from '@/lib/accounts-config'

// Se lee en cada petición: si a alguien le quitan el rol de guía, lo nota en su próxima visita
export async function getActor(h?: Headers): Promise<Actor | null> {
  if (!accountsConfigured()) return null
  const auth = await getAuth()
  const s = await auth.api.getSession({ headers: h ?? (await headers()) })
  return s ? actorFromSession(s.user, parseAdminEmails(process.env.ADMIN_EMAILS)) : null
}
