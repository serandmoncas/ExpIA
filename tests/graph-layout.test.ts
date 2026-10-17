import { describe, it, expect } from 'vitest'
import { layoutGraph } from '@/lib/graph-layout'

describe('layoutGraph', () => {
  const nodes = [
    { id: 'a', requires: [] },
    { id: 'b', requires: ['a'] },
    { id: 'c', requires: ['b', 'oculto'] },
  ]
  it('pone cada prerrequisito a la izquierda de quien lo requiere', () => {
    const { positions } = layoutGraph(nodes)
    expect(positions.a.x).toBeLessThan(positions.b.x)
    expect(positions.b.x).toBeLessThan(positions.c.x)
  })
  it('solo crea aristas entre nodos visibles, del prerrequisito al dependiente', () => {
    const { edges } = layoutGraph(nodes)
    expect(edges).toEqual([
      { id: 'a->b', source: 'a', target: 'b' },
      { id: 'b->c', source: 'b', target: 'c' },
    ])
  })
  it('maneja una lista vacía', () => {
    expect(layoutGraph([])).toEqual({ positions: {}, edges: [] })
  })
})
