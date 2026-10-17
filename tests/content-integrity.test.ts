import { describe, it, expect } from 'vitest'
import { loadCatalog } from '@/lib/content/load'
import { findUncoveredFundamentals } from '@/lib/people'

describe('content/ real', () => {
  it('pasa todas las reglas de integridad', () => {
    const catalog = loadCatalog()
    expect(catalog.nodes.length).toBeGreaterThan(0)
  })

  it('cada nodo fundamental tiene al menos un referente', () => {
    const { nodes, people } = loadCatalog()
    expect(findUncoveredFundamentals(nodes, people)).toEqual([])
  })
})
