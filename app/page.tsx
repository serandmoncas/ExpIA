import Link from 'next/link'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { countByCategory, selectTrending, selectLatestAdded, selectFundamentals } from '@/lib/dashboard'
import { NodeCard } from '@/components/node-card'
import { PersonCard } from '@/components/person-card'
import { selectStarterPeople } from '@/lib/people'
import { ThisWeekBlock } from '@/components/this-week-block'
import { getLatestReport, sourceNames } from '@/lib/radar'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export default function Home() {
  const { nodes, categories, people, reports, sources } = getCatalog()
  const latestReport = getLatestReport(reports)
  const starters = selectStarterPeople(people)
  const topicTitles = Object.fromEntries(nodes.map((n) => [n.id, n.title]))
  const metas = nodes.map(toMeta)
  const counts = countByCategory(metas, categories)
  const max = Math.max(1, ...counts.map((c) => c.count))
  const trending = selectTrending(metas)
  const latest = selectLatestAdded(metas)
  const fundamentals = selectFundamentals(metas)

  return (
    <div className="space-y-12">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">ExpIA</h1>
        <p className="max-w-2xl text-muted-foreground">
          Aprende IA navegando conceptos y herramientas por fecha, por lo que necesitas saber antes y por lo que está tomando fuerza.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Nodos en total" value={metas.length} />
        <Stat label="Conceptos y técnicas" value={metas.filter((n) => n.kind === 'concept' || n.kind === 'technique').length} />
        <Stat label="Herramientas y modelos" value={metas.filter((n) => n.kind === 'tool' || n.kind === 'model').length} />
        <Stat label="Tomando fuerza" value={metas.filter((n) => n.status === 'emerging' || n.status === 'rising').length} />
        <Stat label="Referentes" value={people.length} />
      </section>

      {trending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Tomando fuerza</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trending.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
          </div>
        </section>
      )}

      {latestReport && <ThisWeekBlock report={latestReport} topicTitles={topicTitles} sourceNames={sourceNames(sources, people)} />}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Por categoría</h2>
        <ul className="space-y-1.5">
          {counts.map(({ category, count }) => (
            <li key={category.id}>
              <Link href={`/explore?cat=${category.id}`} className="group grid grid-cols-[160px_1fr_32px] items-center gap-3 text-sm">
                <span className="truncate group-hover:underline">{category.label}</span>
                <span className="h-2 rounded-full bg-muted">
                  <span className="block h-2 rounded-full" style={{ width: `${(count / max) * 100}%`, background: category.color }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Empieza por los fundamentos</h2>
        <div className="flex flex-wrap gap-2">
          {fundamentals.map((n) => (
            <Link key={n.id} href={`/node/${n.id}`} className="rounded-full border px-3 py-1 text-sm hover:border-foreground/40">{n.title}</Link>
          ))}
        </div>
      </section>

      {starters.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Referentes para empezar</h2>
            <Link href="/people" className="text-sm underline underline-offset-4">Ver todos</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((p) => <PersonCard key={p.id} person={p} topicTitles={topicTitles} />)}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Últimos agregados</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((n) => <NodeCard key={n.id} node={n} categories={categories} />)}
        </div>
      </section>
    </div>
  )
}
