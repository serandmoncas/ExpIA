import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { LABELS, RELEVANCES } from '@/lib/content/enums'
import { formatWeek, sourceNames } from '@/lib/radar'
import { Markdown } from '@/components/markdown'
import { ReportItemCard } from '@/components/report-item-card'
import { ProposalList } from '@/components/proposal-list'

type Props = { params: Promise<{ week: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().reports.map((r) => ({ week: r.week }))
}

export async function generateMetadata({ params }: Props) {
  const { week } = await params
  return getCatalog().reports.some((r) => r.week === week) ? { title: `Radar: semana del ${formatWeek(week)}` } : {}
}

export default async function ReportPage({ params }: Props) {
  const { week } = await params
  const { reports, nodes, people, sources } = getCatalog()
  const report = reports.find((r) => r.week === week)
  if (!report) notFound()

  const topicTitles = Object.fromEntries(nodes.map((n) => [n.id, n.title]))
  const personNames = Object.fromEntries(people.map((p) => [p.id, p.name]))
  const names = sourceNames(sources, people)
  const groups = RELEVANCES.map((rel) => ({ rel, items: report.items.filter((i) => i.relevance === rel) })).filter((g) => g.items.length > 0)

  return (
    <article className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <Link href="/radar" className="text-sm text-muted-foreground hover:underline">← Todos los informes</Link>
        <h1 className="text-3xl font-bold">Radar: semana del {formatWeek(report.week)}</h1>
        <p className="text-sm text-muted-foreground">
          Del {formatWeek(report.from)} al {formatWeek(report.week)} · {report.sourcesChecked} fuentes consultadas
        </p>
        {report.generated.by === 'manual' && (
          <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            Informe escrito a mano como ejemplo; no lo generó el agente.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Resumen de la semana</h2>
        <Markdown source={report.summary} />
      </section>

      {groups.map(({ rel, items }) => (
        <section key={rel} className="space-y-3">
          <h2 className="text-xl font-semibold">Relevancia {LABELS[rel].toLowerCase()}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((i) => <ReportItemCard key={i.url} item={i} topicTitles={topicTitles} sourceName={names[i.source] ?? i.source} />)}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Cambios en el catálogo</h2>
        <ProposalList proposals={report.proposals} nodeTitles={topicTitles} personNames={personNames} />
      </section>
    </article>
  )
}
