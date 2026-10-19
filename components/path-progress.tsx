'use client'
import { pathProgress } from '@/lib/paths'
import { useLearned } from './learned-provider'

export function PathProgress({ ids }: { ids: string[] }) {
  const { learned, ready } = useLearned()
  const { done, total } = ready ? pathProgress(ids, learned) : { done: 0, total: ids.length }
  return (
    <div data-testid="path-progress" className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {done} de {total}{done === total && total > 0 ? ' · ¡Completada!' : ''}
      </p>
    </div>
  )
}
