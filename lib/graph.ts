export interface GraphNode {
  id: string
  requires?: string[]
}

function requiresIndex(nodes: GraphNode[]): Map<string, string[]> {
  return new Map(nodes.map((n) => [n.id, n.requires ?? []]))
}

export function detectCycle(nodes: GraphNode[]): string[] | null {
  const req = requiresIndex(nodes)
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (id: string): string[] | null => {
    if (!req.has(id) || state.get(id) === 'done') return null
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id]
    state.set(id, 'visiting')
    stack.push(id)
    for (const r of req.get(id)!) {
      const cycle = visit(r)
      if (cycle) return cycle
    }
    stack.pop()
    state.set(id, 'done')
    return null
  }

  for (const n of nodes) {
    const cycle = visit(n.id)
    if (cycle) return cycle
  }
  return null
}

export function topoSort(nodes: GraphNode[]): string[] {
  const cycle = detectCycle(nodes)
  if (cycle) throw new Error(`Ciclo en requires: ${cycle.join(' → ')}`)
  const req = requiresIndex(nodes)
  const seen = new Set<string>()
  const out: string[] = []
  const visit = (id: string) => {
    if (seen.has(id) || !req.has(id)) return
    seen.add(id)
    for (const r of req.get(id)!) visit(r)
    out.push(id)
  }
  for (const n of nodes) visit(n.id)
  return out
}

export function getPrerequisites(nodes: GraphNode[], id: string): string[] {
  const req = requiresIndex(nodes)
  if (!req.has(id)) throw new Error(`Nodo desconocido: ${id}`)
  const seen = new Set<string>([id])
  const out: string[] = []
  const visit = (current: string) => {
    for (const r of req.get(current) ?? []) {
      if (seen.has(r)) continue
      seen.add(r)
      visit(r)
      out.push(r)
    }
  }
  visit(id)
  return out
}

export function getDependents(nodes: GraphNode[], id: string): string[] {
  return nodes.filter((n) => n.requires?.includes(id)).map((n) => n.id)
}

export function getLearningPath(nodes: GraphNode[], targetId: string): string[] {
  return [...getPrerequisites(nodes, targetId), targetId]
}

// Para resaltar en el mapa: usar siempre el grafo completo, no el subconjunto filtrado,
// para que la cadena no se corte en nodos ocultos
export function getHighlight(nodes: GraphNode[], id: string): Set<string> {
  return new Set([id, ...getPrerequisites(nodes, id), ...getDependents(nodes, id)])
}
