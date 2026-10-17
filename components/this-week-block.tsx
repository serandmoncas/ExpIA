import Link from 'next/link'
import type { Report } from '@/lib/content/types'
import { formatWeek, getTopItems } from '@/lib/radar'
import { ReportItemCard } from './report-item-card'

export function ThisWeekBlock({ report, topicTitles, sourceNames }: { report: Report; topicTitles: Record<string, string>; sourceNames: Record<string, string> }) {
  const top = getTopItems(report)
  if (top.length === 0) return null
  return (
    <section data-testid="this-week" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Esta semana en IA</h2>
        <Link href={`/radar/${report.week}`} className="text-sm underline underline-offset-4">Ver el informe completo</Link>
      </div>
      <p className="text-sm text-muted-foreground">Semana del {formatWeek(report.week)}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((i) => <ReportItemCard key={i.url} item={i} topicTitles={topicTitles} sourceName={sourceNames[i.source] ?? i.source} />)}
      </div>
    </section>
  )
}
