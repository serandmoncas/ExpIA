import Link from 'next/link'
import { LABELS } from '@/lib/content/enums'
import { highlightLanguage } from '@/lib/people'
import type { Person } from '@/lib/content/types'

export function HighlightList({ person, topicTitles }: { person: Person; topicTitles: Record<string, string> }) {
  return (
    <ul className="space-y-3">
      {person.highlights.map((h) => (
        <li key={h.url} className="rounded-lg border p-3">
          <a href={h.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{h.title}</a>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{LABELS[h.format]}</span>
            <span>{highlightLanguage(person, h).toUpperCase()}</span>
            {h.topic && (
              <Link href={`/node/${h.topic}`} className="underline underline-offset-2">{topicTitles[h.topic] ?? h.topic}</Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
