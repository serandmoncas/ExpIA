import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { LABELS, PLATFORMS } from '@/lib/content/enums'
import type { Person } from '@/lib/content/types'

export function PersonCard({ person, topicTitles }: { person: Person; topicTitles: Record<string, string> }) {
  const platforms = PLATFORMS.filter((p) => person.platforms[p])
  return (
    <Link
      href={`/people/${person.id}`}
      data-testid="person-card"
      data-languages={person.languages.join(',')}
      className="block rounded-lg border p-4 transition hover:border-foreground/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{person.name}</h3>
        <div className="flex shrink-0 gap-1">
          {person.languages.map((l) => <Badge key={l} variant="outline">{l.toUpperCase()}</Badge>)}
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{person.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{platforms.map((p) => LABELS[p]).join(' · ')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {person.topics.slice(0, 4).map((t) => <Badge key={t} variant="secondary">{topicTitles[t] ?? t}</Badge>)}
        {person.topics.length > 4 && <span className="text-xs text-muted-foreground">+{person.topics.length - 4}</span>}
      </div>
    </Link>
  )
}
