import Link from 'next/link'
import { formatWeek, type Mention } from '@/lib/radar'

export function RecentMentions({ mentions, sourceNames }: { mentions: Mention[]; sourceNames: Record<string, string> }) {
  if (mentions.length === 0) return null
  return (
    <section data-testid="recent-mentions">
      <h2 className="mb-2 font-semibold">Menciones recientes</h2>
      <ul className="space-y-2 text-sm">
        {mentions.map(({ item, week }) => (
          <li key={item.url}>
            <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{item.title}</a>
            <p className="text-xs text-muted-foreground">
              {sourceNames[item.source] ?? item.source} ·{' '}
              <Link href={`/radar/${week}`} className="underline underline-offset-4">Radar del {formatWeek(week)}</Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
