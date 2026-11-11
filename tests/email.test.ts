import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { LIMITS, magicLinkMail, sendLimited, type Mail } from '@/lib/email'
import { resetDb, testDb } from './helpers/db'

let db: Db
let sent: Mail[]
const mailer = async (m: Mail) => { sent.push(m) }
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); sent = [] })

const now = new Date('2026-10-19T12:00:00Z')

describe('límites de envío', () => {
  it('envía como máximo 5 enlaces mágicos por correo por hora', async () => {
    for (let i = 0; i < 6; i++) await sendLimited(db, mailer, { kind: 'magic-link', to: 'Ana@x.com' }, magicLinkMail('http://u'), now)
    expect(sent).toHaveLength(LIMITS.magicLinkPerHour)
    const later = new Date(now.getTime() + 61 * 60 * 1000)
    expect(await sendLimited(db, mailer, { kind: 'magic-link', to: 'ana@x.com' }, magicLinkMail('http://u'), later)).toBe(true)
  })
  it('envía como máximo 100 invitaciones por guía por día', async () => {
    for (let i = 0; i < 101; i++) await sendLimited(db, mailer, { kind: 'invite', to: `a${i}@x.com`, actorId: 'g1' }, magicLinkMail('http://u'), now)
    expect(sent).toHaveLength(LIMITS.invitesPerDay)
    expect(await sendLimited(db, mailer, { kind: 'invite', to: 'z@x.com', actorId: 'g2' }, magicLinkMail('http://u'), now)).toBe(true)
  })
})
