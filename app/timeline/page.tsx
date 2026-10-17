import { Suspense } from 'react'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { TimelineClient } from '@/components/timeline-client'

export const metadata = { title: 'Línea de tiempo' }

export default function TimelinePage() {
  const { nodes, categories } = getCatalog()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Línea de tiempo</h1>
      <Suspense>
        <TimelineClient nodes={nodes.map(toMeta)} categories={categories} />
      </Suspense>
    </div>
  )
}
