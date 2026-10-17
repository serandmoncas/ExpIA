import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { GraphClient } from '@/components/graph-client'

export const metadata = { title: 'Mapa' }

export default function GraphPage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mapa de dependencias</h1>
      <Suspense>
        <GraphClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
