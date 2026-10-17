import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { getLearningPath } from '@/lib/graph'
import { pathsContaining, toStepViews } from '@/lib/paths'
import { PathProgress } from '@/components/path-progress'
import { PathSteps } from '@/components/path-step'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().nodes.map((n) => ({ id: n.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const node = getCatalog().byId.get(id)
  return node ? { title: `Aprender ${node.title} desde cero` } : {}
}

export default async function LearnPage({ params }: Props) {
  const { id } = await params
  const { nodes, byId, people, paths } = getCatalog()
  const node = byId.get(id)
  if (!node) notFound()
  const ids = getLearningPath(nodes, id)
  const inPaths = pathsContaining(paths, id)

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Aprender {node.title} desde cero</h1>
        <p className="text-muted-foreground">
          {ids.length === 1
            ? 'No tiene prerrequisitos: puedes empezar directamente.'
            : `${ids.length} pasos: primero lo que conviene saber antes y al final ${node.title}.`}
        </p>
        {inPaths.length > 0 && (
          <p className="text-sm text-muted-foreground">
            También aparece en:{' '}
            {inPaths.map((p, i) => (
              <span key={p.id}>{i > 0 && ', '}<Link href={`/paths/${p.id}`} className="underline underline-offset-4">{p.title}</Link></span>
            ))}
          </p>
        )}
        <PathProgress ids={ids} />
      </header>
      <PathSteps steps={toStepViews(ids.map((node) => ({ node })), byId, people)} />
    </div>
  )
}
