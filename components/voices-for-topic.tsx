'use client'
import Link from 'next/link'
import { useAudience } from './audience-provider'
import { LABELS } from '@/lib/content/enums'
import { getVoicesForTopic, highlightLanguage, type TopicHighlight } from '@/lib/people'
import type { Person } from '@/lib/content/types'

export function VoicesForTopic({ nodeId, nodeTitle, voices, highlights }: { nodeId: string; nodeTitle: string; voices: Person[]; highlights: TopicHighlight[] }) {
  const { audience } = useAudience()
  if (voices.length === 0 && highlights.length === 0) return null
  const ordered = getVoicesForTopic(voices, nodeId, audience).slice(0, 6)

  return (
    <section data-testid="voices-for-topic">
      <h2 className="mb-2 font-semibold">Quién habla de esto</h2>
      {highlights.length > 0 && (
        <ul className="mb-3 space-y-2 text-sm">
          {highlights.map(({ person, highlight }) => (
            <li key={highlight.url}>
              <a href={highlight.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{highlight.title}</a>
              <p className="text-xs text-muted-foreground">
                {person.name} · {LABELS[highlight.format]} · {highlightLanguage(person, highlight).toUpperCase()}
              </p>
            </li>
          ))}
        </ul>
      )}
      {ordered.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {ordered.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <Link href={`/people/${p.id}`} className="hover:underline">{p.name}</Link>
              <span className="text-xs text-muted-foreground">{p.languages.map((l) => l.toUpperCase()).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/people?topic=${nodeId}`} className="mt-2 inline-block text-xs underline underline-offset-4">
        Ver todos los referentes de {nodeTitle}
      </Link>
    </section>
  )
}
