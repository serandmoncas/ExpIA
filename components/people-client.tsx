'use client'
import { useMemo } from 'react'
import { PeopleFilterBar } from './people-filter-bar'
import { PersonCard } from './person-card'
import { Button } from '@/components/ui/button'
import { useUrlPeopleFilters } from '@/hooks/use-url-filters'
import { applyPeopleFilters, EMPTY_PEOPLE_FILTERS } from '@/lib/filters'
import { createSearch } from '@/lib/search'
import type { Person } from '@/lib/content/types'

export function PeopleClient({ people, topics }: { people: Person[]; topics: { id: string; title: string }[] }) {
  const topicIds = useMemo(() => topics.map((t) => t.id), [topics])
  const topicTitles = useMemo(() => Object.fromEntries(topics.map((t) => [t.id, t.title])), [topics])
  const [filters, setFilters] = useUrlPeopleFilters(topicIds)
  const search = useMemo(() => createSearch(people, ['name', 'summary']), [people])
  const results = useMemo(() => applyPeopleFilters(search(filters.q), filters), [search, filters])

  return (
    <div className="space-y-6">
      <PeopleFilterBar topics={topics} filters={filters} onChange={setFilters} />
      <p className="text-sm text-muted-foreground">{results.length} de {people.length} referentes</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">Ningún referente coincide con estos filtros.</p>
          <Button variant="link" onClick={() => setFilters(EMPTY_PEOPLE_FILTERS)}>Limpiar filtros</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => <PersonCard key={p.id} person={p} topicTitles={topicTitles} />)}
        </div>
      )}
    </div>
  )
}
