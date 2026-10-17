import Link from 'next/link'
import type { ReportItem } from '@/lib/content/schema'
import { Badge } from '@/components/ui/badge'

export function ReportItemCard({ item, topicTitles, sourceName }: { item: ReportItem; topicTitles: Record<string, string>; sourceName: string }) {
  return (
    <article data-testid="report-item" className="space-y-2 rounded-lg border p-4">
      <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{item.title}</a>
      <p className="text-xs text-muted-foreground">{sourceName} · {item.publishedAt}</p>
      <p className="text-sm">{item.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.topics.map((t) => (
          <Link key={t} href={`/node/${t}`}>
            <Badge variant="outline">{topicTitles[t] ?? t}</Badge>
          </Link>
        ))}
      </div>
    </article>
  )
}
