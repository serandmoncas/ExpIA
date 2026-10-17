import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { ExploreClient } from '@/components/explore-client'

export const metadata = { title: 'Explorar' }

export default function ExplorePage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Explorar</h1>
      <Suspense>
        <ExploreClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
