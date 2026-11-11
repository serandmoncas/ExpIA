import { getDb } from '@/lib/db/client'
import { getMailer } from '@/lib/email'
import { parseAdminEmails } from '@/lib/access'
import { createAuth, type Auth } from '@/lib/auth-config'

let instance: Promise<Auth> | undefined

// BETTER_AUTH_URL y BETTER_AUTH_SECRET los lee Better Auth del entorno
export function getAuth(): Promise<Auth> {
  return (instance ??= (async () => {
    const id = process.env.GOOGLE_CLIENT_ID
    const secret = process.env.GOOGLE_CLIENT_SECRET
    return createAuth({
      db: await getDb(),
      mailer: getMailer(),
      admins: parseAdminEmails(process.env.ADMIN_EMAILS),
      google: id && secret ? { clientId: id, clientSecret: secret } : undefined,
    })
  })())
}
