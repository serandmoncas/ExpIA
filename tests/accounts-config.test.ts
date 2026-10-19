import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountsConfigured } from '@/lib/accounts-config'
import { GET, POST } from '@/app/api/auth/[...all]/route'

afterEach(() => vi.unstubAllEnvs())

describe('accountsConfigured', () => {
  it('es verdadero con DATABASE_URL o con EXPIA_E2E=1', () => {
    expect(accountsConfigured({ DATABASE_URL: 'postgres://x' })).toBe(true)
    expect(accountsConfigured({ EXPIA_E2E: '1' })).toBe(true)
  })
  it('es falso sin ninguna de las dos', () => {
    expect(accountsConfigured({})).toBe(false)
    expect(accountsConfigured({ DATABASE_URL: '', EXPIA_E2E: '0' })).toBe(false)
  })
})

describe('/api/auth sin base de datos', () => {
  const sinCuentas = () => { vi.stubEnv('DATABASE_URL', ''); vi.stubEnv('EXPIA_E2E', '') }
  it('get-session responde 200 con null', async () => {
    sinCuentas()
    const res = await GET(new Request('http://localhost:3000/api/auth/get-session'))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
  it('cualquier otra petición responde 503', async () => {
    sinCuentas()
    expect((await POST(new Request('http://localhost:3000/api/auth/sign-in/magic-link', { method: 'POST' }))).status).toBe(503)
    expect((await GET(new Request('http://localhost:3000/api/auth/callback/google'))).status).toBe(503)
  })
})
