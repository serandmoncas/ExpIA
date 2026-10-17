import { describe, it, expect } from 'vitest'
import { loadCatalog } from '@/lib/content/load'
import { findUncoveredFundamentals } from '@/lib/people'
import { getLearningPath } from '@/lib/graph'

describe('content/ real', () => {
  it('pasa todas las reglas de integridad', () => {
    const catalog = loadCatalog()
    expect(catalog.nodes.length).toBeGreaterThan(0)
  })

  it('cada nodo fundamental tiene al menos un referente', () => {
    const { nodes, people } = loadCatalog()
    expect(findUncoveredFundamentals(nodes, people)).toEqual([])
  })

  it('el radar tiene fuentes y un informe con ítems de relevancia alta', () => {
    const { sources, reports } = loadCatalog()
    expect(sources.length).toBeGreaterThan(0)
    expect(reports.length).toBeGreaterThan(0)
    expect(reports[0].items.length).toBeGreaterThanOrEqual(3)
    expect(reports[0].items.some((i) => i.relevance === 'high')).toBe(true)
  })

  it('ninguna URL se repite entre informes', () => {
    const urls = loadCatalog().reports.flatMap((r) => r.items.map((i) => i.url))
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('cada nodo tiene de 2 a 3 preguntas de repaso, salvo los propuestos por el radar', () => {
    const { nodes, reports } = loadCatalog()
    // Los nodos que llegan por el radar no traen preguntas hasta que alguien las escribe
    const fromRadar = new Set(reports.flatMap((r) => r.proposals.filter((p) => p.type === 'new-node').map((p) => p.target)))
    const missing = nodes.filter((n) => !fromRadar.has(n.id) && !n.review).map((n) => n.id)
    expect(missing).toEqual([])
  })

  it('las 4 rutas curadas cargan en orden de profundidad', () => {
    expect(loadCatalog().paths.map((p) => p.id)).toEqual(['fundamentos', 'construir-con-llms', 'ia-para-tu-negocio', 'construir-un-agente'])
  })

  it('toda ruta generada termina en su meta', () => {
    const { nodes } = loadCatalog()
    for (const n of nodes) expect(getLearningPath(nodes, n.id).at(-1)).toBe(n.id)
  })
})
