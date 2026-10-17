'use client'
import { useAudience } from './audience-provider'
import type { AudiencePref } from '@/lib/audience'

const OPTIONS: { value: AudiencePref; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'technical', label: 'Técnico' },
  { value: 'business', label: 'No técnico' },
]

export function AudienceToggle() {
  const { audience, setAudience } = useAudience()
  return (
    <div role="group" aria-label="Audiencia" className="inline-flex rounded-md border p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={audience === o.value}
          onClick={() => setAudience(o.value)}
          className={`rounded px-2.5 py-1 transition ${audience === o.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
