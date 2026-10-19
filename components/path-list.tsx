'use client'
import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import { orderPathsForAudience, stepIds } from '@/lib/paths'
import type { LearningPath } from '@/lib/content/types'
import { useAudience } from './audience-provider'
import { PathProgress } from './path-progress'

export function PathList({ paths }: { paths: LearningPath[] }) {
  const { audience } = useAudience()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {orderPathsForAudience(paths, audience).map((p) => (
        <Link key={p.id} href={`/paths/${p.id}`} data-testid="path-card" className="space-y-2 rounded-lg border p-4 hover:border-foreground/40">
          <h2 className="font-semibold">{p.title}</h2>
          <p className="text-sm text-muted-foreground">{p.goal}</p>
          <p className="text-xs text-muted-foreground">
            {p.steps.length} pasos · {p.audience.map((a) => LABELS[a]).join(' · ')}
          </p>
          <PathProgress ids={stepIds(p)} />
        </Link>
      ))}
    </div>
  )
}
