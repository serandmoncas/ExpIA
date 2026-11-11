import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { assignments, memberships } from '@/lib/db/schema'
import { getCatalog } from '@/lib/content/load'
import { NotFoundError, type Actor } from '@/lib/access'
import { archiveGroup, assignPath, createGroup } from '@/lib/groups'
import { getLearned, groupProgress, importLearned, setLearned, studentGroups } from '@/lib/progress'
import { resetDb, seedUser, testDb } from './helpers/db'

const catalog = getCatalog()
let db: Db
beforeAll(async () => { db = await testDb() })
beforeEach(() => resetDb(db))

const asActor = (u: { id: string; email: string; name: string; isGuide: boolean }): Actor => ({ ...u, isAdmin: false })

describe('lo aprendido', () => {
  it('marca, desmarca y no duplica', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'llm', true)
    await setLearned(db, u.id, 'llm', true)
    await setLearned(db, u.id, 'transformer', true)
    await setLearned(db, u.id, 'transformer', false)
    expect(await getLearned(db, u.id)).toEqual(['llm'])
  })
  it('importar une con lo que ya hay y no borra nada', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'llm', true)
    expect((await importLearned(db, u.id, ['transformer', 'llm'])).sort()).toEqual(['llm', 'transformer'])
  })
  it('conserva un nodo que ya no está en el catálogo', async () => {
    const u = await seedUser(db)
    await setLearned(db, u.id, 'nodo-retirado', true)
    expect(await getLearned(db, u.id)).toEqual(['nodo-retirado'])
  })
})

describe('tabla del guía', () => {
  async function setup() {
    const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
    const group = await createGroup(db, g, 'Taller')
    const ana = await seedUser(db, { name: 'Ana' })
    const beto = await seedUser(db, { name: 'Beto' })
    await db.insert(memberships).values([{ groupId: group.id, userId: ana.id }, { groupId: group.id, userId: beto.id }])
    await assignPath(db, g, group.id, 'curated:fundamentos', '2026-11-30', catalog)
    return { g, group, ana, beto }
  }

  it('muestra N de M por alumno y por ruta asignada', async () => {
    const { g, group, ana } = await setup()
    await setLearned(db, ana.id, 'machine-learning', true)
    await setLearned(db, ana.id, 'neural-network', true)
    const t = await groupProgress(db, g, group.id, catalog)
    const title = catalog.paths.find((p) => p.id === 'fundamentos')!.title
    expect(t.columns).toEqual([{ ref: 'curated:fundamentos', title, total: 10, dueDate: '2026-11-30' }])
    expect(t.rows.map((r) => [r.name, r.cells])).toEqual([
      ['Ana', [{ done: 2, total: 10 }]],
      ['Beto', [{ done: 0, total: 10 }]],
    ])
  })
  it('lo marcado fuera de las rutas asignadas no se cuenta', async () => {
    const { g, group, ana } = await setup()
    await setLearned(db, ana.id, 'mcp', true)
    const t = await groupProgress(db, g, group.id, catalog)
    expect(t.rows[0].cells[0]).toEqual({ done: 0, total: 10 })
  })
  it('una ruta que desaparece del catálogo queda como columna no disponible', async () => {
    const { g, group } = await setup()
    await db.insert(assignments).values({ groupId: group.id, pathRef: 'curated:retirada' })
    const t = await groupProgress(db, g, group.id, catalog)
    expect(t.columns[1]).toEqual({ ref: 'curated:retirada', title: null, total: 0, dueDate: null })
    expect(t.rows[0].cells[1]).toBeNull()
  })
  it('otro guía no ve la tabla', async () => {
    const { group } = await setup()
    const other = asActor(await seedUser(db, { isGuide: true }))
    await expect(groupProgress(db, other, group.id, catalog)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('grupos del alumno', () => {
  it('lista sus grupos activos con el avance en cada ruta asignada', async () => {
    const g = asActor(await seedUser(db, { isGuide: true, name: 'Profe' }))
    const active = await createGroup(db, g, 'Activo')
    const old = await createGroup(db, g, 'Viejo')
    const s = await seedUser(db)
    await db.insert(memberships).values([{ groupId: active.id, userId: s.id }, { groupId: old.id, userId: s.id }])
    await assignPath(db, g, active.id, 'generated:llm', null, catalog)
    await archiveGroup(db, g, old.id)
    await setLearned(db, s.id, 'llm', true)
    const out = await studentGroups(db, s.id, catalog)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Activo', guideName: 'Profe' })
    expect(out[0].paths[0]).toMatchObject({ ref: 'generated:llm', href: '/learn/llm', done: 1 })
  })
})
