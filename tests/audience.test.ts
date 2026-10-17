import { describe, it, expect } from 'vitest'
import { readAudience, writeAudience, sectionOrder, AUDIENCE_KEY } from '@/lib/audience'

describe('readAudience', () => {
  it('lee un valor válido', () => {
    expect(readAudience({ getItem: () => 'business' })).toBe('business')
  })
  it('devuelve "all" para valores desconocidos o sin storage', () => {
    expect(readAudience({ getItem: () => 'otro' })).toBe('all')
    expect(readAudience({ getItem: () => null })).toBe('all')
    expect(readAudience(undefined)).toBe('all')
  })
  it('devuelve "all" si el storage lanza error', () => {
    expect(readAudience({ getItem: () => { throw new Error('SecurityError') } })).toBe('all')
  })
})

describe('writeAudience', () => {
  it('escribe con la clave esperada y no lanza error si el storage falla', () => {
    const store: Record<string, string> = {}
    writeAudience({ setItem: (k, v) => { store[k] = v } }, 'technical')
    expect(store[AUDIENCE_KEY]).toBe('technical')
    expect(() => writeAudience({ setItem: () => { throw new Error('QuotaExceeded') } }, 'all')).not.toThrow()
  })
})

describe('sectionOrder', () => {
  it('pone primero la sección no técnica para business', () => {
    expect(sectionOrder('business')).toEqual(['nonTechnical', 'purpose', 'usage'])
    expect(sectionOrder('technical')).toEqual(['purpose', 'usage', 'nonTechnical'])
    expect(sectionOrder('all')).toEqual(['purpose', 'usage', 'nonTechnical'])
  })
})
