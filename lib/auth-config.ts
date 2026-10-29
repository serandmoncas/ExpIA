import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { normalizeEmail } from '@/lib/access'
import { claimGuideInvite } from '@/lib/groups'
import { magicLinkMail, sendLimited, type Mailer } from '@/lib/email'
import { registrationAllowed } from '@/lib/registration'

export type AuthDeps = {
  db: Db
  mailer: Mailer
  admins: ReadonlySet<string>
  baseURL?: string
  secret?: string
  google?: { clientId: string; clientSecret: string }
}

export function createAuth(deps: AuthDeps, extraPlugins: BetterAuthPlugin[] = []) {
  const { db, mailer, admins } = deps
  return betterAuth({
    baseURL: deps.baseURL,
    secret: deps.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    user: {
      additionalFields: { isGuide: { type: 'boolean', defaultValue: false, input: false } },
      // Nadie se registra solo: cada cuenta nueva necesita una invitación (o ser administrador)
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.action !== 'create-user') return
        const ok = await registrationAllowed(db, admins, String(user.email ?? ''), {
          cookieHeader: ctx?.headers?.get('cookie') ?? null,
          callbackURL: ctx?.query?.callbackURL,
        })
        if (!ok) return { error: 'not_invited', errorDescription: 'Necesitas una invitación para entrar.' }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            const email = normalizeEmail(u.email)
            // Better Auth guarda name: "" en las altas por enlace mágico
            return { data: { ...u, email, name: u.name?.trim() || email.split('@')[0] } }
          },
          after: async (u) => { await claimGuideInvite(db, u) },
        },
      },
    },
    socialProviders: deps.google ? { google: deps.google } : {},
    plugins: [
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }, ctx) => {
          const to = normalizeEmail(email)
          const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, to))
          // A un correo sin cuenta ni invitación no se le envía nada (y no se avisa, para no revelar quién está)
          if (!existing && !(await registrationAllowed(db, admins, to, {
            cookieHeader: ctx?.headers?.get('cookie') ?? null,
            callbackURL: ctx?.body?.callbackURL,
          }))) return
          await sendLimited(db, mailer, { kind: 'magic-link', to }, magicLinkMail(url))
        },
      }),
      ...extraPlugins,
      nextCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
