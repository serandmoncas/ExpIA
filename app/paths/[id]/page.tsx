import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCatalog } from '@/lib/content/load'
import { stepIds, toStepViews } from '@/lib/paths'
import { LABELS } from '@/lib/content/enums'
import { Markdown } from '@/components/markdown'
import { PathProgress } from '@/components/path-progress'
import { PathSteps } from '@/components/path-step'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return getCatalog().paths.map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const p = getCatalog().paths.find((x) => x.id === id)
  return p ? { title: p.title, description: p.goal } : {}
}

export default async function PathPage({ params }: Props) {
  const { id } = await params
  const { paths, byId, people } = getCatalog()
  const path = paths.find((p) => p.id === id)
  if (!path) notFound()
  const after = path.after ? paths.find((p) => p.id === path.after) : undefined

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/paths" className="hover:underline">Rutas</Link> · {path.audience.map((a) => LABELS[a]).join(' · ')}
        </p>
        <h1 className="text-3xl font-bold">{path.title}</h1>
        <p className="text-lg text-muted-foreground">{path.goal}</p>
        <Markdown source={path.intro} />
        {after && (
          <div data-testid="after-notice" className="space-y-2 rounded-md border px-3 py-2 text-sm">
            <p>Esta ruta asume <Link href={`/paths/${after.id}`} className="underline underline-offset-4">{after.title}</Link>.</p>
            <PathProgress ids={stepIds(after)} />
          </div>
        )}
        <PathProgress ids={stepIds(path)} />
      </header>
      <PathSteps steps={toStepViews(path.steps, byId, people)} />
    </div>
  )
}
