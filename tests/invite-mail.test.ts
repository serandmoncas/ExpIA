import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import type { Mail } from '@/lib/email'
import type { Actor } from '@/lib/access'
import { createGroup } from '@/lib/groups'
import { sendEmailInvites } from '@/lib/invite-mail'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); sent = [] })

describe('invitar por correo', () => {
  it('envía un correo por persona con su propio enlace y el nombre del grupo', async () => {
    const g: Actor = { ...(await seedUser(db, { isGuide: true, name: 'Profe' })), isAdmin: false }
    const group = await createGroup(db, g, 'Taller')
    const r = await sendEmailInvites(db, async (m) => { sent.push(m) }, g, group.id, 'ana@x.com, beto@x.com', 'https://expia.dev')
    expect(r).toEqual({ sent: 2, skipped: 0 })
    expect(sent.map((m) => m.to)).toEqual(['ana@x.com', 'beto@x.com'])
    expect(sent[0].text).toContain('Profe te invitó al grupo «Taller»')
    const urls = sent.map((m) => m.text.match(/https:\/\/expia\.dev\/unirse\/\S+/)![0])
    expect(new Set(urls).size).toBe(2)
  })
})
