'use client'
import { LABELS } from '@/lib/content/enums'

export type Option = { value: string; label: string; color?: string }

export const enumOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: LABELS[v] }))

export function ChipGroup({ label, options, selected, onToggle }: { label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {options.map((o) => {
        const active = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition ${active ? 'border-foreground bg-foreground text-background' : 'hover:border-foreground/40'}`}
          >
            {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
