import dagre from '@dagrejs/dagre'

export const NODE_SIZE = { width: 180, height: 44 }

export function layoutGraph(nodes: { id: string; requires: string[] }[]) {
  const visible = new Set(nodes.map((n) => n.id))
  const edges = nodes.flatMap((n) =>
    n.requires.filter((r) => visible.has(r)).map((r) => ({ id: `${r}->${n.id}`, source: r, target: n.id })),
  )
  const positions: Record<string, { x: number; y: number }> = {}
  if (nodes.length === 0) return { positions, edges }

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 16, ranksep: 70 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { ...NODE_SIZE })
  for (const e of edges) g.setEdge(e.source, e.target)
  dagre.layout(g)

  for (const n of nodes) {
    const { x, y } = g.node(n.id)
    positions[n.id] = { x: x - NODE_SIZE.width / 2, y: y - NODE_SIZE.height / 2 }
  }
  return { positions, edges }
}
