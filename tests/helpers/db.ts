import { sql } from 'drizzle-orm'
import { openPglite, type Db } from '@/lib/db/client'
import { user } from '@/lib/db/schema'

export const testDb = (): Promise<Db> => openPglite()

// Borra todo: las tablas que cuelgan de user caen por CASCADE
export async function resetDb(db: Db): Promise<void> {
  await db.execute(sql`TRUNCATE "user", "verification", "guide_invites", "email_log" RESTART IDENTITY CASCADE`)
}

let seq = 0
export async function seedUser(db: Db, over: { email?: string; name?: string; isGuide?: boolean } = {}) {
  seq++
  const [u] = await db
    .insert(user)
    .values({
      id: `u${seq}`,
      name: over.name ?? `Persona ${seq}`,
      email: over.email ?? `p${seq}@test.com`,
      emailVerified: true,
      isGuide: over.isGuide ?? false,
    })
    .returning()
  return u
}
