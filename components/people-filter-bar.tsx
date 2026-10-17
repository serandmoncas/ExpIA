'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChipGroup, enumOptions } from './chip-group'
import { TopicPicker } from './topic-picker'
import { LANGUAGES, PLATFORMS, AUDIENCES, LEVELS, PERSON_KINDS } from '@/lib/content/enums'
import { EMPTY_PEOPLE_FILTERS, toggleValue, type PeopleFilters } from '@/lib/filters'

type ListKey = 'lang' | 'platform' | 'aud' | 'level' | 'kind'

export function PeopleFilterBar({ topics, filters, onChange }: { topics: { id: string; title: string }[]; filters: PeopleFilters; onChange: (f: PeopleFilters) => void }) {
  const toggle = (key: ListKey, v: string) => onChange({ ...filters, [key]: toggleValue(filters[key] as string[], v) } as PeopleFilters)
  const groups: { key: ListKey; label: string; values: readonly string[] }[] = [
    { key: 'lang', label: 'Idioma', values: LANGUAGES },
    { key: 'platform', label: 'Plataforma', values: PLATFORMS },
    { key: 'aud', label: 'Audiencia', values: AUDIENCES },
    { key: 'level', label: 'Nivel', values: LEVELS },
    { key: 'kind', label: 'Tipo', values: PERSON_KINDS },
  ]
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Input placeholder="Buscar referentes…" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} />
      <TopicPicker topics={topics} selected={filters.topic} onChange={(topic) => onChange({ ...filters, topic })} />
      {groups.map((g) => (
        <ChipGroup key={g.key} label={g.label} options={enumOptions(g.values)} selected={filters[g.key] as string[]} onToggle={(v) => toggle(g.key, v)} />
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_PEOPLE_FILTERS)}>Limpiar filtros</Button>
    </div>
  )
}
