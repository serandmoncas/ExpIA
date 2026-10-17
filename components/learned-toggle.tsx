'use client'
import { cn } from '@/lib/utils'
import { useLearned } from './learned-provider'

export function LearnedToggle({ nodeId }: { nodeId: string }) {
  const { learned, ready, toggle } = useLearned()
  const done = learned.has(nodeId)
  return (
    <button
      type="button"
      data-testid="learned-toggle"
      data-ready={ready}
      aria-pressed={done}
      onClick={() => toggle(nodeId)}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm',
        done ? 'border-emerald-600 bg-emerald-600 text-white' : 'hover:border-foreground/40',
      )}
    >
      {done ? '✓ Aprendido' : 'Lo aprendí'}
    </button>
  )
}
