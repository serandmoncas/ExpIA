import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { learnedApi } from '@/lib/api/learned'
import { getLearned } from '@/lib/progress'
import { resetDb, seedUser, testDb } from './helpers/db'

let db: Db
let current: string | null
beforeAll(async () => { db = await testDb() })
beforeEach(async () => { await resetDb(db); current = null })

const api = () => learnedApi({ db, userId: async () => current, known: new Set(['llm', 'transformer']) })
const post = (body: unknown) => new Request('http://x/api/learned', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

describe('/api/learned', () => {
  it('sin sesión responde 401', async () => {
    expect((await api().list(new Request('http://x'))).status).toBe(401)
    expect((await api().toggle(post({ nodeId: 'llm', learned: true }))).status).toBe(401)
    expect((await api().importIds(post({ ids: [] }))).status).toBe(401)
  })
  it('marca, lista y desmarca', async () => {
    current = (await seedUser(db)).id
    expect((await api().toggle(post({ nodeId: 'llm', learned: true }))).status).toBe(200)
    expect(await (await api().list(new Request('http://x'))).json()).toEqual({ ids: ['llm'] })
    await api().toggle(post({ nodeId: 'llm', learned: false }))
    expect(await getLearned(db, current)).toEqual([])
  })
  it('rechaza un nodo que no existe o un cuerpo mal formado', async () => {
    current = (await seedUser(db)).id
    expect((await api().toggle(post({ nodeId: 'inventado', learned: true }))).status).toBe(400)
    expect((await api().toggle(post({ nodeId: 'llm' }))).status).toBe(400)
    expect((await api().toggle(new Request('http://x', { method: 'POST', body: 'no es json' }))).status).toBe(400)
  })
  it('importar filtra ids desconocidos y repetidos, y une con lo existente', async () => {
    current = (await seedUser(db)).id
    await api().toggle(post({ nodeId: 'transformer', learned: true }))
    const res = await api().importIds(post({ ids: ['llm', 'llm', 'inventado', 42] }))
    expect((await res.json()).ids.sort()).toEqual(['llm', 'transformer'])
  })
  it('rechaza importar más de 500 ids', async () => {
    current = (await seedUser(db)).id
    expect((await api().importIds(post({ ids: Array.from({ length: 501 }, () => 'llm') }))).status).toBe(400)
  })
})
