'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { YearInput } from './year-input'
import { KINDS, AUDIENCES, LEVELS, STATUSES, LICENSES, PRICINGS, LABELS } from '@/lib/content/enums'
import { EMPTY_FILTERS, toggleValue, type Filters } from '@/lib/filters'
import type { Category } from '@/lib/content/schema'

type ListKey = 'cat' | 'kind' | 'aud' | 'level' | 'status' | 'license' | 'pricing'
type Option = { value: string; label: string; color?: string }

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void }) {
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

const enumOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: LABELS[v] }))

export function FilterBar({ categories, filters, onChange }: { categories: Category[]; filters: Filters; onChange: (f: Filters) => void }) {
  const toggle = (key: ListKey, v: string) => onChange({ ...filters, [key]: toggleValue(filters[key] as string[], v) } as Filters)
  const groups: { key: ListKey; label: string; options: Option[] }[] = [
    { key: 'cat', label: 'Categoría', options: categories.map((c) => ({ value: c.id, label: c.label, color: c.color })) },
    { key: 'kind', label: 'Tipo', options: enumOptions(KINDS) },
    { key: 'aud', label: 'Audiencia', options: enumOptions(AUDIENCES) },
    { key: 'level', label: 'Nivel', options: enumOptions(LEVELS) },
    { key: 'status', label: 'Estado', options: enumOptions(STATUSES) },
    { key: 'license', label: 'Licencia', options: enumOptions(LICENSES) },
    { key: 'pricing', label: 'Precio', options: enumOptions(PRICINGS) },
  ]
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Buscar conceptos y herramientas…" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} />
      {groups.map((g) => (
        <ChipGroup key={g.key} label={g.label} options={g.options} selected={filters[g.key] as string[]} onToggle={(v) => toggle(g.key, v)} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <YearInput label="Desde" value={filters.from} onCommit={(from) => onChange({ ...filters, from })} />
        <YearInput label="Hasta" value={filters.to} onCommit={(to) => onChange({ ...filters, to })} />
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>Limpiar filtros</Button>
      </div>
    </div>
  )
}
