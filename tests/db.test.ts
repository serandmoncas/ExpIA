import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { groups, learned, memberships, user } from '@/lib/db/schema'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

describe('base de datos', () => {
  it('aplica las migraciones y guarda lo aprendido una vez por nodo', async () => {
    const u = await seedUser(db)
    await db.insert(learned).values({ userId: u.id, nodeId: 'llm' })
    await db.insert(learned).values({ userId: u.id, nodeId: 'llm' }).onConflictDoNothing()
    expect(await db.select().from(learned)).toHaveLength(1)
  })

  it('al borrar una persona se borran su avance y sus membresías', async () => {
    const guide = await seedUser(db, { isGuide: true })
    const student = await seedUser(db)
    const [g] = await db.insert(groups).values({ name: 'A', guideId: guide.id }).returning()
    await db.insert(memberships).values({ groupId: g.id, userId: student.id })
    await db.insert(learned).values({ userId: student.id, nodeId: 'llm' })
    await db.delete(user).where(eq(user.id, student.id))
    expect(await db.select().from(memberships)).toHaveLength(0)
    expect(await db.select().from(learned)).toHaveLength(0)
  })
})
