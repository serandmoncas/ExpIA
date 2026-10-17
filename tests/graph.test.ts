import { describe, it, expect } from 'vitest'
import { detectCycle, topoSort, getPrerequisites, getDependents, getLearningPath, getHighlight, type GraphNode } from '@/lib/graph'

const chain: GraphNode[] = [
  { id: 'c', requires: ['b'] },
  { id: 'b', requires: ['a'] },
  { id: 'a' },
]
// diamante: d necesita b y c; ambos necesitan a
const diamond: GraphNode[] = [
  { id: 'd', requires: ['b', 'c'] },
  { id: 'b', requires: ['a'] },
  { id: 'c', requires: ['a'] },
  { id: 'a', requires: [] },
]

function assertValidOrder(order: string[], nodes: GraphNode[]) {
  const pos = new Map(order.map((id, i) => [id, i]))
  for (const n of nodes) for (const r of n.requires ?? []) {
    if (pos.has(n.id) && pos.has(r)) expect(pos.get(r)!).toBeLessThan(pos.get(n.id)!)
  }
}

describe('detectCycle', () => {
  it('devuelve null en un grafo dirigido sin ciclos', () => {
    expect(detectCycle(diamond)).toBeNull()
  })
  it('reporta un ciclo de 3 nodos', () => {
    const cycle = detectCycle([{ id: 'a', requires: ['b'] }, { id: 'b', requires: ['c'] }, { id: 'c', requires: ['a'] }])
    expect(cycle).not.toBeNull()
    expect(cycle![0]).toBe(cycle![cycle!.length - 1])
    expect(new Set(cycle)).toEqual(new Set(['a', 'b', 'c']))
  })
  it('reporta una autodependencia', () => {
    expect(detectCycle([{ id: 'a', requires: ['a'] }])).toEqual(['a', 'a'])
  })
  it('ignora requires a nodos que no existen', () => {
    expect(detectCycle([{ id: 'a', requires: ['zzz'] }])).toBeNull()
  })
})

describe('topoSort', () => {
  it('pone los prerrequisitos primero', () => {
    const order = topoSort(diamond)
    expect(order).toHaveLength(4)
    assertValidOrder(order, diamond)
  })
  it('lanza error con un ciclo', () => {
    expect(() => topoSort([{ id: 'a', requires: ['b'] }, { id: 'b', requires: ['a'] }])).toThrow(/Ciclo en requires/)
  })
})

describe('getPrerequisites', () => {
  it('devuelve una cadena transitiva en orden de aprendizaje', () => {
    expect(getPrerequisites(chain, 'c')).toEqual(['a', 'b'])
  })
  it('no duplica en un diamante y respeta el orden', () => {
    const pre = getPrerequisites(diamond, 'd')
    expect(pre).toHaveLength(3)
    expect(new Set(pre)).toEqual(new Set(['a', 'b', 'c']))
    assertValidOrder(pre, diamond)
  })
  it('devuelve [] para una raíz', () => {
    expect(getPrerequisites(chain, 'a')).toEqual([])
  })
  it('lanza error con un id desconocido', () => {
    expect(() => getPrerequisites(chain, 'nope')).toThrow(/desconocido/)
  })
})

describe('getDependents / getLearningPath', () => {
  it('devuelve los dependientes directos', () => {
    expect(getDependents(diamond, 'a').sort()).toEqual(['b', 'c'])
    expect(getDependents(diamond, 'd')).toEqual([])
  })
  it('la ruta de aprendizaje termina en el objetivo', () => {
    expect(getLearningPath(chain, 'c')).toEqual(['a', 'b', 'c'])
  })
})

describe('getHighlight', () => {
  it('incluye el nodo, sus prerrequisitos transitivos y sus dependientes directos', () => {
    expect(getHighlight(diamond, 'b')).toEqual(new Set(['b', 'a', 'd']))
  })
  it('atraviesa nodos que la vista filtra (se calcula sobre el grafo completo)', () => {
    // c → b → a: aunque b esté oculto en la vista, a sigue siendo prerrequisito de c
    expect(getHighlight(chain, 'c').has('a')).toBe(true)
  })
})
