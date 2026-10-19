import { getDb } from '@/lib/db/client'
import { getMailer } from '@/lib/email'
import { parseAdminEmails } from '@/lib/access'
import { createAuth, type Auth } from '@/lib/auth-config'
import { testLogin, testPlugins } from '@/lib/test-login'

export const dynamic = 'force-dynamic'

let testAuth: Promise<Auth> | undefined

export async function GET(req: Request) {
  return testLogin(req, {
    env: process.env,
    db: getDb,
    // Instancia aparte con el plugin de pruebas; misma base y mismo secreto que la real
    auth: () =>
      (testAuth ??= (async () =>
        createAuth({ db: await getDb(), mailer: getMailer(), admins: parseAdminEmails(process.env.ADMIN_EMAILS) }, testPlugins()))()),
  })
}
