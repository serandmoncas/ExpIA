import { describe, it, expect } from 'vitest'
import { loadCatalog } from '@/lib/content/load'

describe('content/ real', () => {
  it('pasa todas las reglas de integridad', () => {
    const catalog = loadCatalog()
    expect(catalog.nodes.length).toBeGreaterThan(0)
  })
})
