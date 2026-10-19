'use client'
import Link from 'next/link'
import { pickContinue } from '@/lib/paths'
import type { LearningPath } from '@/lib/content/types'
import { useLearned } from './learned-provider'

export function ContinueLearning({ paths, titles }: { paths: LearningPath[]; titles: Record<string, string> }) {
  const { learned, ready } = useLearned()
  if (paths.length === 0) return null
  const current = ready ? pickContinue(paths, learned) : undefined
  return (
    <section data-testid="continue-learning" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Sigue aprendiendo</h2>
        <Link href="/paths" className="text-sm underline underline-offset-4">Ver todas las rutas</Link>
      </div>
      {current ? (
        <div className="rounded-lg border p-4 text-sm">
          <p>
            Vas en <Link href={`/paths/${current.path.id}`} className="font-semibold hover:underline">{current.path.title}</Link>{' '}
            <span className="text-muted-foreground">({current.done} de {current.total})</span>.
          </p>
          <p className="mt-1">
            Siguiente paso: <Link href={`/node/${current.next}`} className="underline underline-offset-4">{titles[current.next] ?? current.next}</Link>
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <Link href={`/paths/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
              <p className="text-xs text-muted-foreground">{p.goal}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
