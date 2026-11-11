import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/lib/db/client'
import { createAuth } from '@/lib/auth-config'
import { e2eEnabled, testLogin, testPlugins } from '@/lib/test-login'
import { testDb } from './helpers/db'

let db: Db
beforeAll(async () => { db = await testDb() })

const deps = (env: Record<string, string | undefined>) => ({
  env,
  db: async () => db,
  auth: async () =>
    createAuth({ db, mailer: async () => {}, admins: new Set(), baseURL: 'http://localhost:3100', secret: 'b'.repeat(40) }, testPlugins()),
})
const req = (q: string) => new Request(`http://localhost:3100/api/test/login?${q}`)

describe('login de prueba', () => {
  it('no existe sin EXPIA_E2E', async () => {
    expect(e2eEnabled({})).toBe(false)
    expect((await testLogin(req('email=a@x.com'), deps({}))).status).toBe(404)
  })
  it('no existe en ningún despliegue de Vercel, aunque tenga EXPIA_E2E', async () => {
    expect(e2eEnabled({ EXPIA_E2E: '1', VERCEL: '1' })).toBe(false)
    expect((await testLogin(req('email=a@x.com'), deps({ EXPIA_E2E: '1', VERCEL: '1' }))).status).toBe(404)
  })
  it('con EXPIA_E2E crea la persona, deja la cookie de sesión y redirige a una ruta interna', async () => {
    const res = await testLogin(req('email=Nuevo@X.com&next=/guia'), deps({ EXPIA_E2E: '1' }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3100/guia')
    expect(res.headers.get('set-cookie')).toContain('session_token')
  })
  it('ignora un next a otro dominio', async () => {
    const res = await testLogin(req('email=a@x.com&next=//evil.com'), deps({ EXPIA_E2E: '1' }))
    expect(res.headers.get('location')).toBe('http://localhost:3100/cuenta')
  })
})
