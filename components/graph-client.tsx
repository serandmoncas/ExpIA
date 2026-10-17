'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ReactFlow, Background, Controls, Position, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { FilterBar } from './filter-bar'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import { layoutGraph, NODE_SIZE } from '@/lib/graph-layout'
import { getHighlight } from '@/lib/graph'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function GraphClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const [selected, setSelected] = useState<string | null>(null)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const visible = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])
  const layout = useMemo(() => layoutGraph(visible), [visible])
  const colorOf = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const selectedNode = visible.find((n) => n.id === selected)
  const highlight = useMemo(() => (selectedNode ? getHighlight(nodes, selectedNode.id) : null), [selectedNode, nodes])

  const rfNodes: Node[] = visible.map((n) => ({
    id: n.id,
    position: layout.positions[n.id],
    data: { label: n.title },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      width: NODE_SIZE.width,
      fontSize: 12,
      borderWidth: 2,
      borderColor: colorOf.get(n.category[0]) ?? '#888888',
      opacity: highlight && !highlight.has(n.id) ? 0.2 : 1,
    },
  }))
  const rfEdges: Edge[] = layout.edges.map((e) => {
    const on = !!highlight && highlight.has(e.source) && highlight.has(e.target)
    return { ...e, animated: on, style: { opacity: highlight && !on ? 0.08 : 1 } }
  })

  return (
    <div className="space-y-4">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">Haz clic en un nodo para resaltar lo que necesitas antes y lo que se apoya en él.</p>
      <div className="relative h-[70vh] rounded-lg border">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodeClick={(_, n) => setSelected(n.id)}
          onPaneClick={() => setSelected(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          minZoom={0.1}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
        {selectedNode && (
          <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border bg-background p-3 text-sm shadow">
            <p className="font-semibold">{selectedNode.title}</p>
            <p className="mt-1 text-muted-foreground">{selectedNode.summary}</p>
            <Link href={`/node/${selectedNode.id}`} className="mt-2 inline-block underline underline-offset-4">Ver ficha</Link>
          </div>
        )}
      </div>
    </div>
  )
}
