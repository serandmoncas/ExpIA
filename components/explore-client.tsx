'use client'
import { useMemo } from 'react'
import { FilterBar } from './filter-bar'
import { NodeCard } from './node-card'
import { Button } from '@/components/ui/button'
import { useUrlFilters } from '@/hooks/use-url-filters'
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import type { NodeMeta } from '@/lib/content/types'
import type { Category } from '@/lib/content/schema'

export function ExploreClient({ nodes, categories }: { nodes: NodeMeta[]; categories: Category[] }) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories])
  const [filters, setFilters] = useUrlFilters(categoryIds)
  const search = useMemo(() => createSearch(nodes), [nodes])
  const results = useMemo(() => applyFilters(search(filters.q), filters), [search, filters])

  return (
    <div className="space-y-6">
      <FilterBar categories={categories} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">{results.length} de {nodes.length} nodos</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Ningún nodo coincide con estos filtros.</p>
          <Button variant="link" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
        </div>
      )}
    </div>
  )
}
