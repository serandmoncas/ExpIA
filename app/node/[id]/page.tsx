import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { toMeta } from '@/lib/content/types'
import { getPrerequisites, getDependents } from '@/lib/graph'
import { LABELS } from '@/lib/content/enums'
import { formatReleased } from '@/lib/dates'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/markdown'
import { NodeSectionsView } from '@/components/node-sections'
import { PrereqList } from '@/components/prereq-list'
import { NodeCard } from '@/components/node-card'
import { VoicesForTopic } from '@/components/voices-for-topic'
import { getHighlightsForTopic } from '@/lib/people'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().nodes.map((n) => ({ id: n.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const node = getCatalog().byId.get(id)
  return node ? { title: node.title, description: node.summary } : {}
}

const LINK_LABELS: Record<string, string> = { docs: 'Documentación', paper: 'Paper', repo: 'Repositorio', site: 'Sitio' }

export default async function NodePage({ params }: Props) {
  const { id } = await params
  const { nodes, byId, categories, people } = getCatalog()
  const node = byId.get(id)
  if (!node) notFound()

  const meta = (ids: string[]) => ids.map((i) => toMeta(byId.get(i)!))
  const prereqs = meta(getPrerequisites(nodes, id))
  const dependents = meta(getDependents(nodes, id))
  const related = meta(node.related)
  const voices = people.filter((p) => p.topics.includes(id))
  const topicHighlights = getHighlightsForTopic(people, id)

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <article className="min-w-0 space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">{node.title}</h1>
          <p className="text-lg text-muted-foreground">{node.summary}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{LABELS[node.kind]}</Badge>
            <Badge variant="outline">{LABELS[node.level]}</Badge>
            <Badge variant="outline">{LABELS[node.status]}</Badge>
            {node.license && <Badge variant="outline">{LABELS[node.license]}</Badge>}
            {node.pricing && <Badge variant="outline">{LABELS[node.pricing]}</Badge>}
            <span className="text-muted-foreground">
              {formatReleased(node.date)}{node.origin ? ` · ${node.origin}` : ''}
            </span>
          </div>
          {Object.keys(node.links).length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(node.links).map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{LINK_LABELS[k]}</a>
              ))}
            </div>
          )}
          {!node.verified && (
            <p role="note" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Contenido sin verificar: las fechas y los enlaces de esta ficha aún no han sido revisados por una persona.
            </p>
          )}
        </header>
        <NodeSectionsView
          rendered={{
            purpose: <Markdown source={node.sections.purpose} />,
            usage: <Markdown source={node.sections.usage} />,
            nonTechnical: <Markdown source={node.sections.nonTechnical} />,
          }}
        />
      </article>

      <aside className="space-y-8">
        <section>
          <h2 className="mb-2 font-semibold">Ruta sugerida</h2>
          <p className="mb-2 text-xs text-muted-foreground">Lo que conviene conocer antes, en orden.</p>
          <PrereqList nodes={prereqs} />
        </section>
        <VoicesForTopic nodeId={id} nodeTitle={node.title} voices={voices} highlights={topicHighlights} />
        {dependents.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Qué se apoya en esto</h2>
            <ul className="space-y-1 text-sm">
              {dependents.map((d) => (
                <li key={d.id}><Link href={`/node/${d.id}`} className="hover:underline">{d.title}</Link></li>
              ))}
            </ul>
          </section>
        )}
        {related.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-semibold">Relacionados</h2>
            {related.map((r) => <NodeCard key={r.id} node={r} categories={categories} />)}
          </section>
        )}
      </aside>
    </div>
  )
}
