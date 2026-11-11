import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { testUtils } from 'better-auth/plugins'
import type { Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'
import { normalizeEmail, safeNext } from '@/lib/access'
import { claimGuideInvite } from '@/lib/groups'
import type { Auth } from '@/lib/auth-config'

type Env = Record<string, string | undefined>
type TestCtx = { test: { login(o: { userId: string }): Promise<{ cookies: { name: string; value: string }[] }> } }

// Nunca en Vercel: ni en producción ni en las vistas previas
export const e2eEnabled = (env: Env): boolean => env.EXPIA_E2E === '1' && !env.VERCEL

export const testPlugins = () => [testUtils()]

export async function testLogin(req: Request, deps: { env: Env; db: () => Promise<Db>; auth: () => Promise<Auth> }): Promise<Response> {
  if (!e2eEnabled(deps.env)) return new Response('No encontrado', { status: 404 })
  const url = new URL(req.url)
  const email = normalizeEmail(url.searchParams.get('email') ?? '')
  if (!email) return new Response('Falta email', { status: 400 })
  const db = await deps.db()
  let [u] = await db.select().from(user).where(eq(user.email, email))
  if (!u) {
    ;[u] = await db
      .insert(user)
      .values({ id: crypto.randomUUID(), email, name: url.searchParams.get('name') ?? email.split('@')[0], emailVerified: true })
      .returning()
    await claimGuideInvite(db, u)
  }
  const ctx = (await (await deps.auth()).$context) as unknown as TestCtx
  const { cookies } = await ctx.test.login({ userId: u.id })
  const res = NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url))
  for (const c of cookies) res.cookies.set(c.name, c.value, { path: '/', httpOnly: true, sameSite: 'lax' })
  return res
}
