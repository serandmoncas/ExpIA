import { describe, expect, it } from 'vitest'
import { siteUrl } from '@/lib/site-url'

const h = (o: Record<string, string>) => new Headers(o)

describe('siteUrl', () => {
  it('usa BETTER_AUTH_URL sin la barra final', () => {
    expect(siteUrl(h({ host: 'evil.com' }), { BETTER_AUTH_URL: 'https://expia.dev/', NODE_ENV: 'production' })).toBe('https://expia.dev')
  })
  it('en producción sin BETTER_AUTH_URL falla', () => {
    expect(() => siteUrl(h({ host: 'evil.com' }), { NODE_ENV: 'production' })).toThrow('Falta BETTER_AUTH_URL')
  })
  it('en producción con EXPIA_E2E=1 usa las cabeceras', () => {
    expect(siteUrl(h({ host: 'localhost:3100' }), { NODE_ENV: 'production', EXPIA_E2E: '1' })).toBe('http://localhost:3100')
  })
  it('en desarrollo usa x-forwarded-host y x-forwarded-proto', () => {
    expect(siteUrl(h({ 'x-forwarded-host': 'a.dev', 'x-forwarded-proto': 'https', host: 'b' }), { NODE_ENV: 'development' })).toBe('https://a.dev')
  })
  it('en desarrollo usa host; localhost va por http', () => {
    expect(siteUrl(h({ host: 'localhost:3000' }), { NODE_ENV: 'development' })).toBe('http://localhost:3000')
    expect(siteUrl(h({ host: 'x.dev' }), {})).toBe('https://x.dev')
  })
})
